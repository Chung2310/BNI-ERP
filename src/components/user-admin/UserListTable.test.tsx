// @vitest-environment jsdom
import React from "react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { UserListTable } from "./UserListTable";

afterEach(cleanup);

describe("UserListTable activity action", () => {
  it("passes the selected user to the activity viewer", () => {
    const user = {
      uid: "user-1",
      displayName: "Nguyễn Văn A",
      email: "a@example.com",
      role: "user",
      companyCode: "ACME",
    };
    const onViewActivity = vi.fn();

    render(<UserListTable
      users={([user] as unknown as React.ComponentProps<typeof UserListTable>["users"])}
      currentUser={({ uid: "admin-1", role: "admin" } as unknown as React.ComponentProps<typeof UserListTable>["currentUser"])}
      userPage={1}
      totalUserPages={1}
      onPageChange={vi.fn()}
      openActionMenuId="user-1"
      onToggleActionMenu={vi.fn()}
      onEditUser={vi.fn()}
      onDeleteUser={vi.fn()}
      onViewActivity={onViewActivity}
    />);

    fireEvent.click(screen.getByRole("button", { name: /xem hoạt động/i }));
    expect(onViewActivity).toHaveBeenCalledWith(user);
  });
});
