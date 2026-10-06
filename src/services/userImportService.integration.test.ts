import { beforeAll, afterAll, beforeEach, describe, expect, it } from "vitest";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import bcrypt from "bcryptjs";
import { UserModel } from "../../server/model/user.model";
import { CompanyModel } from "../../server/model/company.model";
import { BranchModel } from "../../server/model/branch.model";
import { RolePermissionModel } from "../../server/model/role-permission.model";
import { importUsers } from "../../server/service/user-import.service";
let db: MongoMemoryServer;
const actor = { companyCode: "A", role: "admin" };
const row = (email="an@import.test", rowNumber=2) => ({rowNumber, displayName:"Nguyễn An", email, phone: rowNumber === 2 ? "0901234567" : "09" + String(rowNumber).padStart(8, "0"), companyName:"Doanh nghiệp riêng",industry:"Công nghệ",birthDate:"1990-08-15"});
beforeAll(async () => {
  db = await MongoMemoryServer.create(); await mongoose.connect(db.getUri(),{dbName:"user_import_isolated_tests"});
  await Promise.all([UserModel.init(),CompanyModel.init(),BranchModel.init(),RolePermissionModel.init()]);
},60000);
afterAll(async()=>{await mongoose.disconnect();if(db)await db.stop();});
beforeEach(async()=>{
  await Promise.all([UserModel.deleteMany({}),CompanyModel.deleteMany({}),BranchModel.deleteMany({}),RolePermissionModel.deleteMany({})]);
  await CompanyModel.create({code:"A",name:"Chapter A",ownerEmail:"admin@import.test"});
});
describe("Excel account import persistence",()=>{
  it("previews without creating accounts and reports duplicates, invalid email, phone and birth dates per row",async()=>{
    await UserModel.create({email:"existing@import.test",displayName:"Existing",companyCode:"B",role:"user"});
    const result=await importUsers({dryRun:true,rows:[row(),row("AN@import.test",3),row("existing@import.test",4),row("invalid",5),{...row("date@import.test",6),birthDate:"2026-02-30"},{...row("phone@import.test",7),phone:"123"}]},actor);
    expect(result).toMatchObject({valid:1,skipped:1,errors:4,created:0});
    expect(await UserModel.countDocuments()).toBe(1);
  });
  it("creates Member accounts in the authenticated company with salted hashes of 123456",async()=>{
    const result=await importUsers({dryRun:false,rows:[row(),row("binh@import.test",3)]},actor);
    expect(result.created).toBe(2);
    const users=await UserModel.find({}).select("+password").sort({email:1});
    expect(users.every(user=>user.role==="user"&&user.companyCode==="A")).toBe(true);
    expect(users[0].phone).toBe("0901234567");
    expect(users[0].birthDate?.toISOString().slice(0,10)).toBe("1990-08-15");
    expect(await bcrypt.compare("123456",users[0].password!)).toBe(true);
    expect(await bcrypt.compare("123456",users[1].password!)).toBe(true);
    expect(users[0].password).not.toBe(users[1].password);
  });
  it("preserves imported fields, accepts phone-only accounts and rejects unsafe image URLs", async () => {
    const profile = { ...row(), photoURL: "https://example.com/avatar.jpg", coverImage: "https://example.com/banner.jpg" };
    expect((await importUsers({ dryRun: false, rows: [profile] }, actor)).created).toBe(1);
    expect(await UserModel.findOne({ email: profile.email }).lean()).toMatchObject({ photoURL: profile.photoURL, coverImage: profile.coverImage, companyName: profile.companyName, industry: profile.industry });
    const result = await importUsers({ dryRun: true, rows: [{ ...row("", 3), phone: "0912345678" }, { ...row("bad@import.test", 4), photoURL: "javascript:alert(1)" }] }, actor);
    expect(result.errors).toBe(1);
    expect(result.rows[0]).toMatchObject({ email: "", status: "valid" });
    expect(result.rows[0].message).toContain("Điện thoại");
    expect(result.rows[1].message).toContain("Ảnh đại diện");
  });
  it("retries skip existing emails without overwriting profile or resetting passwords",async()=>{
    await importUsers({dryRun:false,rows:[row()]},actor);
    const original=await bcrypt.hash("new-password",10);
    await UserModel.updateOne({email:"an@import.test"},{$set:{password:original,displayName:"Changed"}});
    expect(await importUsers({dryRun:false,rows:[row()]},actor)).toMatchObject({created:0,skipped:1});
    const user=await UserModel.findOne({email:"an@import.test"}).select("+password");
    expect(user!.displayName).toBe("Changed");expect(user!.password).toBe(original);
  });
  it("blocks nonadmins, unknown companies, foreign branches and injected role/company/password fields",async()=>{
    await expect(importUsers({dryRun:false,rows:[row()]},{...actor,role:"user"})).rejects.toMatchObject({status:403});
    await expect(importUsers({dryRun:false,rows:[row()]},{...actor,companyCode:"B"})).rejects.toMatchObject({status:400});
    const branch=await BranchModel.create({companyCode:"B",code:"B1",name:"Other"});
    await expect(importUsers({dryRun:false,rows:[row()]},{...actor,branchId:String(branch._id)})).rejects.toMatchObject({status:400});
    for(const injection of [{role:"admin"},{companyCode:"B"},{password:"other"}]){
      expect((await importUsers({dryRun:false,rows:[{...row(),...injection}]},actor)).errors).toBe(1);
    }
    expect(await UserModel.countDocuments()).toBe(0);
  });
  it("assigns the selected company branch and tolerates concurrent duplicate imports",async()=>{
    const branch=await BranchModel.create({companyCode:"A",code:"A1",name:"Branch A"});
    const payload={dryRun:false,rows:[row()]};
    const results=await Promise.all([importUsers(payload,{...actor,branchId:String(branch._id)}),importUsers(payload,{...actor,branchId:String(branch._id)})]);
    expect(results.reduce((sum,result)=>sum+result.created,0)).toBe(1);
    expect(await UserModel.countDocuments()).toBe(1);
    expect(String((await UserModel.findOne())!.branchId)).toBe(String(branch._id));
  });
  it("bounds preview and creation batch sizes",async()=>{
    await expect(importUsers({dryRun:true,rows:Array.from({length:201},(_,i)=>row("u"+i+"@import.test",i+2))},actor)).rejects.toMatchObject({status:400});
    await expect(importUsers({dryRun:false,rows:Array.from({length:21},(_,i)=>row("u"+i+"@import.test",i+2))},actor)).rejects.toMatchObject({status:400});
    await expect(importUsers({dryRun:"false",rows:[row()]},actor)).rejects.toMatchObject({status:400});
  });
});
