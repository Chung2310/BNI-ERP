import { beforeAll, afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { randomUUID } from "node:crypto";
import { UserModel } from "../../server/model/user.model";
import { MemberFeeModel } from "../../server/modules/member-fees/member-fee.model";
import { deleteMemberFee, createMemberFees, getFee, receiveFee, serializeFee, voidFeePayment } from "../../server/modules/member-fees/member-fee.service";
import { feeBalance } from "../../server/modules/member-fees/member-fee.rules";
import { createFeeInput, feePaymentInput } from "../../server/modules/member-fees/member-fee.validation";

import { companyEmailService } from "../../server/service/company-email.service";
vi.mock("../../server/service/company-email.service", () => ({ companyEmailService: { send: vi.fn(), getSmtp: vi.fn() } }));

let database: MongoMemoryServer;
let memberId: string;
let foreignId: string;
const assignment = () => ({ year: 2026, title: "Phí thường niên", amount: 100, dueDate: "2026-12-31", note: "", memberIds: [memberId] });
const receipt = (amount = 40) => ({ id: randomUUID(), amount, paidOn: "2026-01-01", method: "cash", reference: "", note: "" });
beforeAll(async () => {
  database = await MongoMemoryServer.create();
  await mongoose.connect(database.getUri(), { dbName: "member_fee_isolated_tests" });
  await Promise.all([UserModel.init(), MemberFeeModel.init(), SePayTransactionModel.init(), NotificationModel.init()]);
}, 60000);
afterAll(async () => { await mongoose.disconnect(); if (database) await database.stop(); });
afterEach(() => vi.unstubAllEnvs());
beforeEach(async () => {
  vi.mocked(companyEmailService.send).mockReset().mockResolvedValue({ messageId: "test-message" });
  vi.mocked(companyEmailService.getSmtp).mockReset().mockResolvedValue({ hasPassword: true } as any);
  vi.stubEnv("SEPAY_ENABLED", "false");
  await Promise.all([MemberFeeModel.deleteMany({}), UserModel.deleteMany({}), SePayTransactionModel.deleteMany({}), NotificationModel.deleteMany({})]);
  const [member, foreign] = await UserModel.create([
    { displayName: "An", email: "an@fee.test", companyCode: "A", isActive: true },
    { displayName: "Bình", email: "binh@fee.test", companyCode: "B", isActive: true },
  ]);
  memberId = String(member._id); foreignId = String(foreign._id);
});
async function setupFee() { await createMemberFees("A", "admin", assignment()); return String((await MemberFeeModel.findOne({ companyCode: "A" }))!._id); }

describe("annual member fees persisted ledger", () => {
  it("creates once per normalized title, member and year without overwriting an existing fee", async () => {
    expect(await createMemberFees("A", "admin", assignment())).toEqual({created:1,skipped:0});
    expect(await createMemberFees("A", "admin", {...assignment(), title:"  PHÍ   THƯỜNG NIÊN ",amount:200})).toEqual({created:0,skipped:1});
    expect((await MemberFeeModel.findOne({companyCode:"A"}))!.amount).toBe(100);
    await createMemberFees("A","admin",{...assignment(),year:2027});
    expect(await MemberFeeModel.countDocuments()).toBe(2);
  });
  it("rejects foreign members and scopes reads and payments to the organization", async () => {
    await expect(createMemberFees("A","admin",{...assignment(),memberIds:[foreignId]})).rejects.toMatchObject({status:400});
    const id=await setupFee();
    await expect(getFee("B",id)).rejects.toMatchObject({status:404});
    await expect(receiveFee("B",id,"other",receipt())).rejects.toMatchObject({status:404});
    expect(serializeFee(await getFee("A",id)).paid).toBe(0);
  });
  it("records partial payment and makes a retry idempotent", async () => {
    const id=await setupFee(), payment=receipt();
    const first=await receiveFee("A",id,"admin",payment);
    expect(first.paid).toBe(40); expect(first.remaining).toBe(60);
    const repeated=await receiveFee("A",id,"admin",payment);
    expect(repeated.payments).toHaveLength(1);
    await expect(receiveFee("A",id,"admin",{...payment,amount:30})).rejects.toMatchObject({status:409});
  });
  it("rejects overpayment and prevents simultaneous receipts from exceeding the fee", async () => {
    const id=await setupFee();
    await expect(receiveFee("A",id,"admin",receipt(101))).rejects.toMatchObject({status:400});
    const outcomes=await Promise.allSettled([receiveFee("A",id,"one",receipt(60)),receiveFee("A",id,"two",receipt(60))]);
    expect(outcomes.filter(result=>result.status==="fulfilled")).toHaveLength(1);
    expect(serializeFee(await getFee("A",id)).remaining).toBe(40);
  });
  it("voiding a receipt restores the balance and preserves its audit history", async () => {
    const id=await setupFee(), payment=receipt(100);
    expect((await receiveFee("A",id,"admin",payment)).status).toBe("paid");
    const result=await voidFeePayment("A",id,payment.id,"manager","Ghi nhận nhầm");
    expect(result.paid).toBe(0); expect(result.remaining).toBe(100);
    expect(result.payments[0].voidReason).toBe("Ghi nhận nhầm");
    expect(result.payments[0].voidedBy).toBe("manager");
    expect((await voidFeePayment("A",id,payment.id,"manager","Thử lại")).remaining).toBe(100);
  });
  it("validates dates and integer VND amounts, and distinguishes overdue from settled", () => {
    expect(createFeeInput.validate({...assignment(),dueDate:"2026-02-30"}).error).toBeTruthy();
    expect(feePaymentInput.validate(receipt(0.5)).error).toBeTruthy();
    expect(feeBalance({amount:100,dueDate:"2026-01-01",payments:[{id:"p",amount:40}]},"2026-01-02").status).toBe("overdue");
    expect(feeBalance({amount:100,dueDate:"2026-01-01",payments:[{id:"p",amount:100}]},"2026-01-02").status).toBe("paid");
  });
});

import { SePayTransactionModel } from "../../server/modules/member-fees/sepay.model";
import { getSePayConfig, authenticateSePay, notifyFee, feeCheckout, processSePay } from "../../server/modules/member-fees/sepay.service";
import { NotificationModel } from "../../server/model/notification.model";
const apiKey = "test_key_that_is_at_least_32_characters_long";
const settings = { enabled: true, bank: "Vietcombank", accountNumber: "123456789", accountName: "BNI TEST", apiKey };
function configureSePay(value: typeof settings) {
  vi.stubEnv("SEPAY_ENABLED", String(value.enabled));
  vi.stubEnv("SEPAY_COMPANY_CODE", "A");
  vi.stubEnv("SEPAY_BANK", value.bank);
  vi.stubEnv("SEPAY_ACCOUNT_NUMBER", value.accountNumber);
  vi.stubEnv("SEPAY_ACCOUNT_NAME", value.accountName);
  vi.stubEnv("SEPAY_API_KEY", value.apiKey);
}
async function checkoutSetup() {
  const id = await setupFee();
  configureSePay(settings);
  await notifyFee("A", id);
  const fee = await getFee("A", id);
  return { id, fee };
}
function bankTransfer(code: string, id = 123, amount = 40) {
  return { id, gateway: "Vietcombank", transactionDate: "2026-10-01 10:30:00", accountNumber: "123456789",
    code: null, content: code + " chuyen tien", transferType: "in", transferAmount: amount, referenceCode: "FT" + id };
}
describe("SePay annual fee collection", () => {
  it("reads the environment without exposing the secret and verifies the configured organization", async () => {
    configureSePay(settings);
    expect(await getSePayConfig("A")).toMatchObject({ enabled: true, hasApiKey: true });
    expect(JSON.stringify(await getSePayConfig("A"))).not.toContain(apiKey);
    expect(await getSePayConfig("A")).not.toHaveProperty("apiKey");
    await expect(authenticateSePay("A", "Apikey " + apiKey)).resolves.toBeUndefined();
    await expect(authenticateSePay("B", "Apikey " + apiKey)).rejects.toMatchObject({ status: 401 });
    await expect(authenticateSePay("A", "Apikey wrong")).rejects.toMatchObject({ status: 401 });
    configureSePay({ ...settings, enabled: false });
    await expect(authenticateSePay("A", "Apikey " + apiKey)).rejects.toMatchObject({ status: 401 });
  });
  it("sends a member-specific notification once per day, with a checkout deep link", async () => {
    const { id, fee } = await checkoutSetup();
    await Promise.all([notifyFee("A", id), notifyFee("A", id)]);
    const notifications = await NotificationModel.find({ companyCode: "A" });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].recipientUid).toBe(memberId);
    expect(notifications[0].action?.feeId).toBe(id);
    const checkout = await feeCheckout("A", fee);
    expect(checkout).toMatchObject({ amount: 100, paymentCode: expect.stringMatching(/^BNI[A-F0-9]{20}$/), accountNumber: "123456789" });
    expect(new URL(checkout!.qrUrl).searchParams.get("des")).toBe(fee.paymentCode);
    configureSePay({ ...settings, accountNumber: "987654321" });
    expect((await feeCheckout("A", await getFee("A", id)))!.accountNumber).toBe("123456789");
  });
  it("credits concurrent duplicate deliveries once and refreshes the remaining QR amount", async () => {
    const { id, fee } = await checkoutSetup();
    const payload = bankTransfer(fee.paymentCode!);
    await Promise.all(Array.from({length: 5}, () => processSePay("A", payload)));
    const updated = await getFee("A", id);
    expect(serializeFee(updated)).toMatchObject({ paid: 40, remaining: 60, status: "partial" });
    expect(updated.payments).toHaveLength(1);
    expect((await feeCheckout("A", updated))!.amount).toBe(60);
    expect(await SePayTransactionModel.countDocuments()).toBe(1);
    await expect(processSePay("A", { ...payload, transferAmount: 99 })).rejects.toMatchObject({status:409});
    await expect(voidFeePayment("A", id, "sepay:123", "admin", "Hủy nhầm")).rejects.toMatchObject({status:400});
  });
  it("recovers after receipt committed but transaction finalization failed", async () => {
    const { id, fee } = await checkoutSetup();
    const payload = bankTransfer(fee.paymentCode!);
    const original = SePayTransactionModel.updateOne.bind(SePayTransactionModel);
    const spy = vi.spyOn(SePayTransactionModel, "updateOne");
    spy.mockImplementation(((filter: any, update: any, options: any) => {
      if (update.$set?.status === "applied") throw new Error("simulated storage failure");
      return original(filter, update, options);
    }) as any);
    await expect(processSePay("A", payload)).rejects.toThrow("simulated storage failure");
    spy.mockRestore();
    expect((await getFee("A", id)).payments).toHaveLength(1);
    expect((await SePayTransactionModel.findOne())!.status).toBe("pending");
    await processSePay("A", payload);
    expect((await getFee("A", id)).payments).toHaveLength(1);
    expect((await SePayTransactionModel.findOne())!.status).toBe("applied");
  });
  it("records actual overpayment without negative remaining balance", async () => {
    const { id, fee } = await checkoutSetup();
    await processSePay("A", bankTransfer(fee.paymentCode!, 1, 40));
    await processSePay("A", bankTransfer(fee.paymentCode!, 2, 100));
    const updated = await getFee("A", id);
    expect(serializeFee(updated)).toMatchObject({paid:140,remaining:0,overpaid:40,status:"paid"});
    expect(await feeCheckout("A", updated)).toBeNull();
  });
  it("keeps wrong bank, wrong account, ambiguous and foreign-tenant transfers out of fees", async () => {
    const { id, fee } = await checkoutSetup();
    const payload = bankTransfer(fee.paymentCode!);
    expect(await processSePay("A", { ...payload, id: 1, gateway: "MBBank" })).toMatchObject({status:"review"});
    expect(await processSePay("A", { ...payload, id: 2, accountNumber: "wrong" })).toMatchObject({status:"review"});
    expect(await processSePay("A", { ...payload, id: 3, content: "No payment reference" })).toMatchObject({status:"review"});
    expect(await processSePay("A", { ...payload, id: 4, content: payload.content + " BNI0123456789ABCDEF0123" })).toMatchObject({status:"review"});
    expect(await processSePay("B", payload)).toMatchObject({status:"review"});
    expect(await processSePay("A", { ...payload, id: 5, transferType:"out" })).toMatchObject({status:"ignored"});
    expect(serializeFee(await getFee("A", id)).paid).toBe(0);
  });
  it("rejects malformed amounts/dates and does not credit provider test payloads", async () => {
    const { id, fee } = await checkoutSetup();
    const payload = bankTransfer(fee.paymentCode!);
    for (const change of [{transferAmount:0},{transferAmount:-1},{transferAmount:0.5},{transferAmount:"40"},{transactionDate:"2026-02-30 10:00:00"}]) {
      await expect(processSePay("A", {...payload,...change})).rejects.toMatchObject({status:400});
    }
    expect(await processSePay("A", {...payload,id:0})).toMatchObject({status:"test"});
    expect((await getFee("A",id)).payments).toHaveLength(0);
    expect(await SePayTransactionModel.countDocuments()).toBe(0);
  });
});

const routeIdentity = vi.hoisted(() => ({ user: {} as any }));
vi.mock("../../server/middleware/auth", async importOriginal => {
  const actual: any = await importOriginal();
  return { ...actual, requireAuth: (req: any, _res: any, next: any) => { req.user = routeIdentity.user; next(); },
    requirePermission: () => (_req: any, _res: any, next: any) => next() };
});
vi.mock("../../server/middleware/require-module", () => ({ requireModule: () => (_req: any, _res: any, next: any) => next() }));
import express from "express";
import type { Server } from "node:http";
import { memberFeeRouter } from "../../server/modules/member-fees/member-fee.router";
import { webhookRouter } from "../../server/router/webhook.router";
let httpServer: Server;
let baseUrl: string;
beforeAll(async () => {
  const app = express(); app.use(express.json());
  app.use("/fees", memberFeeRouter); app.use("/webhook", webhookRouter);
  await new Promise<void>(resolve => { httpServer = app.listen(0, "127.0.0.1", () => resolve()); });
  baseUrl = "http://127.0.0.1:" + (httpServer.address() as any).port;
});
afterAll(async () => { if (httpServer) await new Promise<void>((resolve, reject) => httpServer.close(e => e ? reject(e) : resolve())); });
describe("fee HTTP authorization and SePay protocol", () => {
  it("restricts members to their own fee and reserves creation/settings/sending to admins", async () => {
    const { id } = await checkoutSetup();
    routeIdentity.user = { id: memberId, role: "user", companyCode: "A" };
    expect((await (await fetch(baseUrl + "/fees/?year=2026")).json()).data).toHaveLength(1);
    expect((await fetch(baseUrl + "/fees/" + id)).status).toBe(200);
    // Even an otherwise privileged non-admin cannot mutate fees.
    for (const [method, path] of [["POST", "/"], ["GET", "/members"], ["GET", "/sepay/config"], ["PUT", "/sepay/config"],
      ["DELETE", "/" + id], ["GET", "/sepay/transactions"], ["POST", "/" + id + "/notify"], ["POST", "/" + id + "/payments"]]) {
      expect((await fetch(baseUrl + "/fees" + path, {method})).status).toBe(403);
    }
    routeIdentity.user = { id: foreignId, role: "manager", companyCode: "A" };
    expect((await (await fetch(baseUrl + "/fees/?year=2026")).json()).data).toHaveLength(0);
    expect((await fetch(baseUrl + "/fees/" + id)).status).toBe(404);
    routeIdentity.user = { id: foreignId, role: "admin", companyCode: "B" };
    expect((await fetch(baseUrl + "/fees/" + id)).status).toBe(404);
    routeIdentity.user = { id: memberId, role: "admin", companyCode: "A" };
    expect((await fetch(baseUrl + "/fees/sepay/config")).status).toBe(200);
  });
  it("rejects unauthenticated webhooks before any write and acknowledges valid/replayed bank callbacks", async () => {
    const { fee, id } = await checkoutSetup();
    const post = (auth: string) => fetch(baseUrl + "/webhook/sepay/A", { method: "POST",
      headers: { "Content-Type": "application/json", Authorization: auth }, body: JSON.stringify(bankTransfer(fee.paymentCode!, 1001, 100)) });
    expect((await post("")).status).toBe(401);
    expect(await SePayTransactionModel.countDocuments()).toBe(0);
    expect(await (await post("Apikey " + apiKey)).json()).toMatchObject({success:true,status:"applied"});
    expect(await (await post("Apikey " + apiKey)).json()).toMatchObject({success:true,status:"applied"});
    expect((await getFee("A", id)).payments).toHaveLength(1);
  });
});

it("fails closed for incomplete environment config and never exposes another organization's account", async () => {
  configureSePay(settings);
  expect(await getSePayConfig("B")).toMatchObject({ enabled: false, bank: "", accountNumber: "", hasApiKey: false });
  for (const name of ["SEPAY_COMPANY_CODE", "SEPAY_BANK", "SEPAY_ACCOUNT_NUMBER", "SEPAY_ACCOUNT_NAME", "SEPAY_API_KEY"]) {
    configureSePay(settings);
    vi.stubEnv(name, "");
    expect((await getSePayConfig("A")).enabled).toBe(false);
    await expect(authenticateSePay("A", "Apikey " + apiKey)).rejects.toMatchObject({ status: 401 });
  }
});
it("does not allow admin HTTP requests to overwrite environment settings", async () => {
  configureSePay(settings);
  routeIdentity.user = { id: memberId, role: "admin", companyCode: "A" };
  const response = await fetch(baseUrl + "/fees/sepay/config", { method: "PUT", headers: {"Content-Type":"application/json"},
    body: JSON.stringify({...settings, accountNumber:"999999"}) });
  expect(response.status).toBe(405);
  expect((await getSePayConfig("A")).accountNumber).toBe("123456789");
});


describe("Fee reminder email", () => {
  it("uses the current member email and outstanding balance, escapes HTML and sends once per day", async () => {
    const id = await setupFee();
    configureSePay(settings);
    await UserModel.updateOne({ _id: memberId }, { $set: { email: "updated@fee.test", displayName: "<b>An</b>" } });
    await receiveFee("A", id, "admin", receipt(40));
    await notifyFee("A", id);
    await Promise.all([notifyFee("A", id), notifyFee("A", id)]);
    expect(companyEmailService.send).toHaveBeenCalledTimes(1);
    const [company, message] = vi.mocked(companyEmailService.send).mock.calls[0];
    expect(company).toBe("A");
    expect(message.to).toBe("updated@fee.test");
    expect(message.text).toContain("60 VND");
    expect(message.text).toContain("31/12/2026");
    expect(message.html).toContain("&lt;b&gt;An&lt;/b&gt;");
    expect(message.html).not.toContain("<b>An</b>");
    expect(message.html).toContain("amount=60");
    const fee = await getFee("A", id);
    expect(message.text).toContain(fee.paymentCode);
    expect(fee.emailNotifiedAt).toBeInstanceOf(Date);
    expect(await NotificationModel.countDocuments({ companyCode: "A" })).toBe(1);
    await MemberFeeModel.updateOne({ _id: id }, { $set: { emailNotifiedDay: "2000-01-01" } });
    await notifyFee("A", id);
    expect(companyEmailService.send).toHaveBeenCalledTimes(2);
  });

  it("retries failed SMTP without duplicating the in-app notification", async () => {
    const id = await setupFee();
    configureSePay(settings);
    vi.mocked(companyEmailService.send).mockRejectedValueOnce(new Error("SMTP unavailable"));
    await expect(notifyFee("A", id)).rejects.toMatchObject({ status: 502 });
    expect((await getFee("A", id)).emailNotifiedAt).toBeUndefined();
    await notifyFee("A", id);
    expect(companyEmailService.send).toHaveBeenCalledTimes(2);
    expect(await NotificationModel.countDocuments({ companyCode: "A" })).toBe(1);
  });

  it("reports missing SMTP and invalid recipient without marking email as sent", async () => {
    const id = await setupFee();
    configureSePay(settings);
    vi.mocked(companyEmailService.getSmtp).mockResolvedValueOnce(null);
    await expect(notifyFee("A", id)).rejects.toMatchObject({ status: 400 });
    await UserModel.updateOne({ _id: memberId }, { $set: { email: "invalid" } });
    await expect(notifyFee("A", id)).rejects.toMatchObject({ status: 400 });
    expect(companyEmailService.send).not.toHaveBeenCalled();
    expect((await getFee("A", id)).emailNotifiedAt).toBeUndefined();
  });

  it("allows only one concurrent SMTP send and recovers an expired claim", async () => {
    const id = await setupFee();
    configureSePay(settings);
    let release!: (value: { messageId: string }) => void;
    vi.mocked(companyEmailService.send).mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
    const first = notifyFee("A", id);
    await vi.waitFor(() => expect(companyEmailService.send).toHaveBeenCalledTimes(1));
    try { await expect(notifyFee("A", id)).rejects.toMatchObject({ status: 409 }); }
    finally { release({ messageId: "first" }); }
    await first;
    await MemberFeeModel.updateOne({ _id: id }, { $set: { emailNotifiedDay: "2000-01-01", emailClaimToken: "stale", emailClaimUntil: new Date(0) } });
    await notifyFee("A", id);
    expect(companyEmailService.send).toHaveBeenCalledTimes(2);
  });

  it("does not send for settled fees or members outside the organization", async () => {
    const id = await setupFee();
    configureSePay(settings);
    await UserModel.updateOne({ _id: memberId }, { $set: { companyCode: "B" } });
    await expect(notifyFee("A", id)).rejects.toMatchObject({ status: 400 });
    await receiveFee("A", id, "admin", receipt(100));
    await expect(notifyFee("A", id)).rejects.toMatchObject({ status: 400 });
    expect(companyEmailService.send).not.toHaveBeenCalled();
  });
});


describe("Collection rounds and fee deletion", () => {
  it("supports identical titles in separate rounds and idempotent retries within a round", async () => {
    const first = { ...assignment(), campaignId: randomUUID() };
    const second = { ...assignment(), campaignId: randomUUID() };
    expect(await createMemberFees("A", "admin", first)).toEqual({ created: 1, skipped: 0 });
    expect(await createMemberFees("A", "admin", first)).toEqual({ created: 0, skipped: 1 });
    expect(await createMemberFees("A", "admin", second)).toEqual({ created: 1, skipped: 0 });
    expect(await MemberFeeModel.countDocuments()).toBe(2);
    await expect(createMemberFees("A", "admin", { ...first, amount: 999 })).rejects.toMatchObject({ status: 409 });
    expect(createFeeInput.validate(first).error).toBeUndefined();
    expect(createFeeInput.validate({ ...first, campaignId: "invalid" }).error).toBeTruthy();
  });

  it("deletes only the requested unpaid fee within its organization", async () => {
    const id = await setupFee();
    await expect(deleteMemberFee("B", id)).rejects.toMatchObject({ status: 404 });
    await deleteMemberFee("A", id);
    await expect(getFee("A", id)).rejects.toMatchObject({ status: 404 });
  });

  it("retains payment history including voided receipts and blocks an active email claim", async () => {
    const id = await setupFee();
    await MemberFeeModel.updateOne({ _id: id }, { $set: { emailClaimUntil: new Date(Date.now() + 60000) } });
    await expect(deleteMemberFee("A", id)).rejects.toMatchObject({ status: 409 });
    const payment = receipt();
    await receiveFee("A", id, "admin", payment);
    await expect(deleteMemberFee("A", id)).rejects.toMatchObject({ status: 409 });
    await voidFeePayment("A", id, payment.id, "admin", "Thu nhầm");
    await MemberFeeModel.updateOne({ _id: id }, { $unset: { emailClaimUntil: 1 } });
    await expect(deleteMemberFee("A", id)).rejects.toMatchObject({ status: 409 });
  });

  it("routes a bank transfer for a deleted fee to manual review", async () => {
    const { id, fee } = await checkoutSetup();
    await deleteMemberFee("A", id);
    expect(await processSePay("A", bankTransfer(fee.paymentCode!))).toMatchObject({ status: "review" });
  });

  it("protects against a bank transfer arriving between lookup and deletion", async () => {
    const { id, fee } = await checkoutSetup();
    const original = MemberFeeModel.deleteOne.bind(MemberFeeModel);
    const spy = vi.spyOn(MemberFeeModel, "deleteOne").mockImplementationOnce((...args: any[]) => ({
      then: async (resolve: any, reject: any) => {
        try { await processSePay("A", bankTransfer(fee.paymentCode!)); resolve(await original(...args as [any])); }
        catch (e) { reject(e); }
      }
    }) as any);
    try { await expect(deleteMemberFee("A", id)).rejects.toMatchObject({ status: 409 }); }
    finally { spy.mockRestore(); }
    expect((await getFee("A", id)).payments).toHaveLength(1);
  });

  it("exposes deletion to admins only and isolates organizations", async () => {
    const id = await setupFee();
    routeIdentity.user = { id: memberId, role: "admin", companyCode: "B" };
    expect((await fetch(baseUrl + "/fees/" + id, { method: "DELETE" })).status).toBe(404);
    routeIdentity.user = { id: memberId, role: "admin", companyCode: "A" };
    expect((await fetch(baseUrl + "/fees/" + id, { method: "DELETE" })).status).toBe(200);
    expect((await fetch(baseUrl + "/fees/" + id)).status).toBe(404);
  });
});


it("credits only the matching round when two rounds have the same title", async () => {
  configureSePay(settings);
  await createMemberFees("A", "admin", { ...assignment(), campaignId: randomUUID() });
  await createMemberFees("A", "admin", { ...assignment(), campaignId: randomUUID() });
  const fees = await MemberFeeModel.find({ companyCode: "A" });
  await Promise.all(fees.map(fee => notifyFee("A", String(fee._id))));
  const first = await getFee("A", String(fees[0]._id));
  const second = await getFee("A", String(fees[1]._id));
  expect(first.paymentCode).not.toBe(second.paymentCode);
  await processSePay("A", bankTransfer(first.paymentCode!));
  expect(serializeFee(await getFee("A", String(first._id))).paid).toBe(40);
  expect(serializeFee(await getFee("A", String(second._id))).paid).toBe(0);
});

it("reviews a transfer if its fee disappears after lookup but before credit", async () => {
  const { id, fee } = await checkoutSetup();
  const original = MemberFeeModel.updateOne.bind(MemberFeeModel);
  const spy = vi.spyOn(MemberFeeModel, "updateOne").mockImplementationOnce((...args: any[]) => ({
    then: async (resolve: any, reject: any) => {
      try { await deleteMemberFee("A", id); resolve(await original(...args as [any, any])); }
      catch (e) { reject(e); }
    }
  }) as any);
  try { expect(await processSePay("A", bankTransfer(fee.paymentCode!))).toMatchObject({ status: "review" }); }
  finally { spy.mockRestore(); }
});

it("returns only newly persisted fee IDs for automatic notifications", async () => {
  const first = await createMemberFees("A", "admin", assignment(), true);
  expect(first.createdIds).toHaveLength(1);
  expect((await getFee("A", first.createdIds![0])).memberId).toBe(memberId);
  const repeated = await createMemberFees("A", "admin", assignment(), true);
  expect(repeated).toMatchObject({ created: 0, skipped: 1, createdIds: [] });
});

it.each(["Z12345", "1E4B52E48889010E07CE", "Z".repeat(30)])("accepts an exact BNI payment code with suffix %s", async suffix => {
  const { id } = await checkoutSetup();
  const paymentCode = "BNI" + suffix;
  await MemberFeeModel.updateOne({ _id: id }, { $set: { paymentCode } });
  const payload = { ...bankTransfer(paymentCode), code: null, content: paymentCode.toLowerCase() + " FT26275299030116 k28HMTIZ/419863" };
  expect(await processSePay("A", payload)).toMatchObject({ status: "applied" });
  expect(serializeFee(await getFee("A", id)).paid).toBe(40);
});
it.each(["BNI12345", "BNI" + "A".repeat(31), "XBNI123456", "BNI123456_ABC"])("does not partially match an invalid payment code %s", async content => {
  const { id } = await checkoutSetup();
  await MemberFeeModel.updateOne({ _id: id }, { $set: { paymentCode: "BNI123456" } });
  expect(await processSePay("A", { ...bankTransfer("BNI123456"), content })).toMatchObject({ status: "review" });
  expect(serializeFee(await getFee("A", id)).paid).toBe(0);
});
