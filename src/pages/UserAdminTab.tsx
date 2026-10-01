/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/exhaustive-deps */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-unused-vars */
import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { authService } from "../services/authService";
import { CompanyProfile, UserProfile } from "../types";
import { toast } from "./Toast";
import { Shield, RefreshCw, Plus, User, X, Wallet, Mail, Lock, SlidersHorizontal } from "lucide-react";
import { parseFirebaseError } from "../utils/firebaseErrorParser";
import { getApiErrorMessage } from "../utils/errorMessage";
import { rolePermissionService, RolePermission, Permission } from "../services/rolePermissionService";
import { UserAdminHeader } from "../components/user-admin/UserAdminHeader";
import { UserAdminTabs } from "../components/user-admin/UserAdminTabs";
import { UserFiltersBar } from "../components/user-admin/UserFiltersBar";
import { UserListTable } from "../components/user-admin/UserListTable";
import { UserFormModal } from "../components/user-admin/UserFormModal";
import { UserDeleteModal } from "../components/user-admin/UserDeleteModal";
import { RoleModal } from "../components/user-admin/RoleModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";
import { getPermissionLabel, getRoleDisplayName } from "../utils/permissionUtils";
import { branchService, BranchRecord } from "../services/branchService";
import { resolveUserAdminBranchId } from "../components/user-admin/userBranchScope";

export default function UserAdminTab() {
  const { userProfile } = useAuth();
  const activeBranchId = userProfile?.branchId || "";
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    cancelLabel?: string;
    onConfirm: () => void | Promise<void>;
  } | null>(null);

  const askConfirm = (
    title: string,
    description: string,
    onConfirm: () => void | Promise<void>,
    confirmLabel = "Xác nhận",
    cancelLabel = "Hủy"
  ) => {
    setConfirmState({
      isOpen: true,
      title,
      description,
      confirmLabel,
      cancelLabel,
      onConfirm: async () => {
        await onConfirm();
        setConfirmState(null);
      },
    });
  };
  
  const [branches, setBranches] = useState<BranchRecord[]>([]);

  // Advanced Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [userPage, setUserPage] = useState(1);
  const USERS_PER_PAGE = 8;

  // Register User Modal States
  const [isUserModalOpen, setIsUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [userDisplayName, setUserDisplayName] = useState("");
  const [userCompanyName, setUserCompanyName] = useState("");
  const [userIndustry, setUserIndustry] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [userBirthDate, setUserBirthDate] = useState("");
  const [userPhotoURL, setUserPhotoURL] = useState("");
  const [userCoverImage, setUserCoverImage] = useState("");
  const [userPassword, setUserPassword] = useState("");
  const [userRole, setUserRole] = useState<string>("user");
  const [userCompanyCode, setUserCompanyCode] = useState<string>("");
  const [userBranchId, setUserBranchId] = useState<string>("");
  const [userParentId, setUserParentId] = useState<string>("");
  const [userDepartment, setUserDepartment] = useState("");
  const [userQualification, setUserQualification] = useState("");
  const [userJobDescriptionLink, setUserJobDescriptionLink] = useState("");
  const [userJobDescriptionUploadToken, setUserJobDescriptionUploadToken] = useState("");
  const [userMonthlySalary, setUserMonthlySalary] = useState("");
  const [submittingUser, setSubmittingUser] = useState(false);

  // Delete User Modal States
  const [userToDelete, setUserToDelete] = useState<UserProfile | null>(null);
  const [isDeleteUserModalOpen, setIsDeleteUserModalOpen] = useState(false);
  const [deletingUser, setDeletingUser] = useState(false);

  const resetUserForm = () => {
    setEditingUser(null);
    setUserDisplayName("");
    setUserCompanyName("");
    setUserIndustry("");
    setUserEmail("");
    setUserPhone("");
    setUserBirthDate("");
    setUserPhotoURL("");
    setUserCoverImage("");
    setUserPassword("");
    setUserRole("user");
    setUserBranchId("");
    setUserParentId("");
    setUserDepartment("");
    setUserQualification("");
    setUserJobDescriptionLink("");
    setUserJobDescriptionUploadToken("");
    setUserMonthlySalary("");
  };

  // Sub-tabs State
  const [activeTab, setActiveTab] = useState<"users" | "roles">("users");
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);


  // Role Permission States
  const [rolePermissionsList, setRolePermissionsList] = useState<RolePermission[]>([]);
  const [systemPermissions, setSystemPermissions] = useState<Permission[]>([]);
  const [roleLoading, setRoleLoading] = useState(false);

  // Add / Edit Role Modal States
  const [isRoleModalOpen, setIsRoleModalOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RolePermission | null>(null);
  const [roleSlug, setRoleSlug] = useState("");
  const [roleDisplayName, setRoleDisplayName] = useState("");
  const [roleLevel, setRoleLevel] = useState<number>(3);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);
  const [submittingRole, setSubmittingRole] = useState(false);

  // Initialize company code when modal opens
  useEffect(() => {
    if (isUserModalOpen) {
      if (editingUser?.companyCode) {
        setUserCompanyCode(editingUser.companyCode);
      } else {
        setUserCompanyCode(userProfile?.companyCode || "SYSTEM");
      }
    }
  }, [editingUser, isUserModalOpen, userProfile]);

  useEffect(() => {
    if (!isUserModalOpen || !userCompanyCode || userCompanyCode === "SYSTEM") { setBranches([]); return; }
    branchService.list().then(setBranches).catch(() => setBranches([]));
  }, [isUserModalOpen, userCompanyCode]);

  // Handle parentId based on userRole and userCompanyCode automatically
  useEffect(() => {
    if (isUserModalOpen) {
      if (userRole === "manager") {
        if (userCompanyCode && userCompanyCode !== "SYSTEM") {
          const companyAdmin = usersList.find(
            (u) => u.companyCode === userCompanyCode && u.role === "admin"
          );
          setUserParentId(companyAdmin?.uid || "");
        } else {
          setUserParentId("");
        }
      } else {
        setUserParentId("");
      }
    }
  }, [userRole, userCompanyCode, usersList, isUserModalOpen]);

  // Auto fill department based on manager (parentId) for user role
  useEffect(() => {
    if (isUserModalOpen && userRole === "user" && userParentId) {
      const selectedManager = usersList.find(u => u.uid === userParentId);
      if (selectedManager && selectedManager.department) {
        setUserDepartment(selectedManager.department);
      }
    } else if (isUserModalOpen && userRole === "user" && !userParentId) {
      setUserDepartment("");
    setUserQualification("");
    }
  }, [userRole, userParentId, usersList, isUserModalOpen]);

  // Reset userDepartment when modal is closed
  useEffect(() => {
    if (!isUserModalOpen) {
      setUserDepartment("");
    setUserQualification("");
      setUserJobDescriptionLink("");
    setUserMonthlySalary("");
      setEditingUser(null);
    }
  }, [isUserModalOpen]);

  // Fetch users list from API
  const fetchUsers = async () => {
    setLoading(true);
    try {
      let data: UserProfile[] = [];
      if (userProfile?.companyCode) {
        const branchId = resolveUserAdminBranchId(userProfile.role, activeBranchId, userProfile.branchId);
        data = await authService.getUsersByCompany(userProfile.companyCode, branchId);
      } else if (userProfile) {
        data = [userProfile];
      }
      setUsersList(data);
    } catch (error) {
      console.error("Lấy danh sách user thất bại:", error);
      toast.error(getApiErrorMessage(error, "Không thể tải danh sách tài khoản người dùng."));
    } finally {
      setLoading(false);
    }
  };

  const fetchRolePermissions = async () => {
    setRoleLoading(true);
    try {
      const code = userProfile?.companyCode;
      const data = await rolePermissionService.getRolePermissions(code);
      setRolePermissionsList(data);
    } catch (error) {
      console.error("Lấy cấu hình vai trò thất bại:", error);
    } finally {
      setRoleLoading(false);
    }
  };

  const fetchSystemPermissions = async () => {
    try {
      const data = await rolePermissionService.getPermissions();
      if (data && data.length > 0) {
        setSystemPermissions(data);
      } else {
        setSystemPermissions([]);
      }
    } catch (error) {
      console.error("Lấy mã quyền hệ thống thất bại:", error);
      setSystemPermissions([]);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchRolePermissions();
    fetchSystemPermissions();
  }, [userProfile?.uid, userProfile?.role, userProfile?.companyCode, userProfile?.branchId, activeBranchId]);

  // Close action menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('[data-action-menu]')) {
        setOpenActionMenuId(null);
      }
    };
    
    if (openActionMenuId) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openActionMenuId]);

  useEffect(() => {
    setUserPage(1);
  }, [searchQuery, filterStartDate, filterEndDate, userProfile?.role]);

  const getAvailableRoles = () => {
    const defaultRoles = [
      { role: "admin", displayName: getRoleDisplayName("admin"), level: 1 },
      { role: "branch_owner", displayName: "BRANCH OWNER", level: 2 },
      { role: "manager", displayName: "MANAGER (Quản lý)", level: 2 },
      { role: "teacher", displayName: getRoleDisplayName("teacher"), level: 3 },
      { role: "user", displayName: "USER (Nhân viên)", level: 3 },
    ];

    // Merge with custom roles
    const customRoles = rolePermissionsList
      .filter(rp => !["user", "teacher", "manager", "branch_owner", "admin"].includes(rp.role))
      .map(rp => ({
        role: rp.role,
        displayName: getRoleDisplayName(rp.role, rp.displayName),
        level: rp.level
      }));

    return [...defaultRoles, ...customRoles];
  };

  // Filter visible users within company
  const visibleUsers = usersList.filter((usr) => {
    if (userProfile?.companyCode && usr.companyCode && usr.companyCode !== userProfile.companyCode) {
      return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      const matchName = usr.displayName?.toLowerCase().includes(query);
      const matchEmail = usr.email?.toLowerCase().includes(query);
      const matchPhone = usr.phone?.toLowerCase().includes(query);
      const matchCompany = usr.companyName?.toLowerCase().includes(query);
      const matchIndustry = usr.industry?.toLowerCase().includes(query);
      if (!matchName && !matchEmail && !matchPhone && !matchCompany && !matchIndustry) return false;
    }

    if (filterStartDate || filterEndDate) {
      if (!usr.createdAt) return false;
      const userDate = new Date(usr.createdAt);
      userDate.setHours(0, 0, 0, 0);

      if (filterStartDate) {
        const start = new Date(filterStartDate);
        start.setHours(0, 0, 0, 0);
        if (userDate < start) return false;
      }

      if (filterEndDate) {
        const end = new Date(filterEndDate);
        end.setHours(23, 59, 59, 999);
        if (userDate > end) return false;
      }
    }

    return true;
  });

  const totalUserPages = Math.max(1, Math.ceil(visibleUsers.length / USERS_PER_PAGE));
  const safeUserPage = Math.min(userPage, totalUserPages);
  const paginatedVisibleUsers = visibleUsers.slice(
    (safeUserPage - 1) * USERS_PER_PAGE,
    safeUserPage * USERS_PER_PAGE
  );

  const handleRoleChange = async (targetUid: string, targetName: string, newRole: "user" | "teacher" | "manager" | "admin") => {
    if (targetUid === userProfile?.uid) {
      toast.warning("Bạn không thể tự thay đổi vai trò của chính mình!");
      return;
    }

    try {
      await authService.updateUserRole(targetUid, newRole);
      toast.success(`Đã cập nhật quyền hạn cho "${targetName}" thành ${newRole.toUpperCase()}!`);
      setUsersList((prev) =>
        prev.map((u) => {
          if (u.uid === targetUid) {
            const dept = newRole === "admin" ? "Ban Giám đốc" : (newRole === "manager" ? "Quản lý" : (newRole === "teacher" ? "Đào tạo" : "Nhân viên"));
            const div = newRole === "admin" ? "Ban Giám đốc" : (newRole === "manager" ? "Quản lý" : (newRole === "teacher" ? "Đào tạo" : "Nhân viên"));
            const title = newRole === "admin" ? "CEO" : (newRole === "manager" ? "Quản lý phòng ban" : (newRole === "teacher" ? "Giảng viên" : "Nhân viên"));
            return { ...u, role: newRole, department: dept, division: div, jobTitle: title };
          }
          return u;
        })
      );
    } catch (error) {
      console.error("Lỗi cập nhật quyền:", error);
      toast.error(getApiErrorMessage(error, "Lỗi khi cập nhật quyền hạn người dùng."));
    }
  };

  const handleRegisterUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDisplayName.trim() || !userEmail.trim() || !userCompanyCode) {
      toast.warning("Vui lòng điền đầy đủ thông tin người dùng!");
      return;
    }
    if (!editingUser && userPassword.length < 6) {
      toast.warning("Mật khẩu phải từ 6 ký tự trở lên!");
      return;
    }

    setSubmittingUser(true);
    try {
      const compName = userCompanyName.trim() || userProfile?.companyName || userCompanyCode;

      // Tìm level của người quản lý để tính level nhân viên mới
      const managerProfile = userParentId ? usersList.find(u => u.uid === userParentId) : null;

      if (editingUser) {
        await authService.updateUser(editingUser.uid, {
          displayName: userDisplayName.trim(),
          companyName: userCompanyName.trim() || undefined,
          industry: userIndustry.trim() || undefined,
          phone: userPhone.trim(),
          birthDate: userBirthDate || null,
          photoURL: userPhotoURL.trim() || undefined,
          coverImage: userCoverImage.trim() || undefined,
          email: userEmail.trim() || undefined,
          password: userPassword.trim() ? userPassword.trim() : undefined,
          role: userRole,
          companyCode: userCompanyCode,
          parentId: userParentId || null,
          level: userRole === "user" && managerProfile?.level ? managerProfile.level + 1 : undefined,
          department: userDepartment.trim() || "",
          division: userDepartment.trim() || "",
          qualification: userQualification.trim(),
          jobDescriptionLink: userJobDescriptionLink.trim() || "",
          jobDescriptionUploadToken: userJobDescriptionUploadToken || undefined,
          monthlySalary: userMonthlySalary === "" ? undefined : Number(userMonthlySalary),
          branchId: userBranchId || null,
        });

        toast.success(`Đã cập nhật tài khoản "${userDisplayName}".`);
      } else {
        await authService.registerUserForCompany(
          userDisplayName.trim(),
          userEmail.trim(),
          userPassword,
          userRole as any,
          userCompanyCode,
          compName,
          userParentId || undefined,
          managerProfile?.level,
          userDepartment.trim() || undefined,
          userDepartment.trim() || undefined,
          userPhone.trim() || undefined,
          undefined,
          userJobDescriptionLink.trim() || undefined,
          userBranchId || undefined,
          userBirthDate || undefined,
          userQualification.trim() || undefined,
          userMonthlySalary === "" ? undefined : Number(userMonthlySalary),
          userJobDescriptionUploadToken || undefined,
          {
            industry: userIndustry.trim() || undefined,
            photoURL: userPhotoURL.trim() || undefined,
            coverImage: userCoverImage.trim() || undefined,
          }
        );

        toast.success(`Đăng ký tài khoản cho "${userDisplayName}" thành công!`);
      }
      setIsUserModalOpen(false);
      resetUserForm();
      // Refresh lists
      await fetchUsers();
    } catch (error: any) {
      console.error(editingUser ? "Lỗi cập nhật người dùng:" : "Lỗi đăng ký người dùng:", error);
      const errMsg = parseFirebaseError(
        error,
        editingUser ? "Không thể cập nhật người dùng." : "Không thể đăng ký người dùng mới."
      );
      toast.error(errMsg);
    } finally {
      setSubmittingUser(false);
    }
  };

  const openCreateUserModal = () => {
    resetUserForm();
    if (activeBranchId) {
      setUserBranchId(activeBranchId);
    }
    setIsUserModalOpen(true);
  };

  const openEditUserModal = (user: UserProfile) => {
    setOpenActionMenuId(null);
    setEditingUser(user);
    setUserDisplayName(user.displayName || "");
    setUserCompanyName(user.companyName || "");
    setUserIndustry(user.industry || "");
    setUserEmail(user.email || "");
    setUserPhone(user.phone && user.phone !== "Chưa cập nhật" ? user.phone : "");
    setUserBirthDate(user.birthDate ? String(user.birthDate).slice(0, 10) : "");
    setUserPhotoURL(user.photoURL || "");
    setUserCoverImage(user.coverImage || "");
    setUserPassword("");
    setUserRole(user.role || "user");
    setUserCompanyCode(user.companyCode || "");
    setUserBranchId(user.branchId || "");
    setUserParentId(user.parentId || "");
    setUserDepartment(user.department || "");
    setUserQualification(user.qualification || "");
    setUserJobDescriptionLink(user.jobDescriptionLink || "");
    setUserMonthlySalary(user.monthlySalary == null ? "" : String(user.monthlySalary));
    setIsUserModalOpen(true);
  };

  const deleteRoleConfirmed = async (role: string) => {
    try {
      const code = userProfile?.companyCode;
      await rolePermissionService.deleteRolePermission(role, code);
      toast.success("Xóa cấu hình vai trò thành công!");
      await fetchRolePermissions();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Xóa vai trò thất bại.");
    }
  };

  const handleDeleteRole = (roleInfo: any) => {
    askConfirm(
      "Xóa vai trò?",
      `Bạn có chắc chắn muốn xóa vai trò "${roleInfo.displayName}"? Hành động này sẽ bỏ phân quyền vai trò.`,
      () => deleteRoleConfirmed(roleInfo.role),
      "Xóa vai trò",
      "Hủy"
    );
  };

  const handleDeleteUser = (user: UserProfile) => {
    setOpenActionMenuId(null);
    if (user.uid === userProfile?.uid) {
      toast.warning("Bạn không thể tự xóa chính mình.");
      return;
    }

    setUserToDelete(user);
    setIsDeleteUserModalOpen(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;
    setDeletingUser(true);
    try {
      await authService.deleteUser(userToDelete.uid);
      setUsersList((prev) => prev.filter((item) => item.uid !== userToDelete.uid));
      toast.success(`Đã xóa người dùng "${userToDelete.displayName}".`);
      setIsDeleteUserModalOpen(false);
      setUserToDelete(null);
    } catch (error: any) {
      console.error("Lỗi xóa người dùng:", error);
      toast.error(error.message || "Không thể xóa người dùng.");
    } finally {
      setDeletingUser(false);
    }
  };


  return (
    <div className="flex flex-col h-full bg-white max-h-[85vh] overflow-hidden" id="user_admin_tab_wrapper">
      <h1 className="sr-only">Quản trị Hệ thống & Phân quyền - {activeTab}</h1>
      
      <UserAdminHeader
        userProfile={userProfile}
        onOpenCreateUserModal={openCreateUserModal}
        onRefresh={fetchUsers}
        loading={loading}
      />

      <UserAdminTabs activeTab={activeTab} onChange={setActiveTab} userProfile={userProfile} />
      {activeTab === "users" ? (
        <>
          <UserFiltersBar
            searchQuery={searchQuery}
            filterStartDate={filterStartDate}
            filterEndDate={filterEndDate}
            visibleUsersCount={visibleUsers.length}
            totalUsersCount={usersList.length}
            onSearchChange={setSearchQuery}
            onFilterStartDateChange={setFilterStartDate}
            onFilterEndDateChange={setFilterEndDate}
            onClear={() => {
              setSearchQuery("");
              setFilterStartDate("");
              setFilterEndDate("");
            }}
          />
          {/* Main List Area */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-6" id="user_admin_content">
            {loading ? (
              <div className="h-48 flex flex-col items-center justify-center text-center">
                <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
                <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-widest">Đang tải danh sách tài khoản...</span>
              </div>
            ) : visibleUsers.length === 0 ? (
              <div className="p-12 text-center bg-gray-50 text-gray-400 italic rounded-2xl border border-dashed">
                Không tìm thấy tài khoản nào trong hệ thống!
              </div>
            ) : (
              <UserListTable
                users={paginatedVisibleUsers}
                currentUser={userProfile}
                rolePermissionsList={rolePermissionsList}
                userPage={safeUserPage}
                totalUserPages={totalUserPages}
                onPageChange={setUserPage}
                getAvailableRoles={getAvailableRoles}
                onRoleChange={handleRoleChange}
                openActionMenuId={openActionMenuId}
                onToggleActionMenu={(uid) => setOpenActionMenuId(openActionMenuId === uid ? null : uid)}
                onEditUser={openEditUserModal}
                onDeleteUser={handleDeleteUser}
              />
            )}
          </div>
        </>      ) : (
        <div className="flex-1 space-y-6 overflow-y-auto p-3 sm:p-6" id="roles_permissions_tab_content">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center bg-gray-50 p-4 rounded-2xl border border-gray-150 gap-4">
            <div>
              <h5 className="font-bold text-slate-800 text-sm">Danh sách vai trò & Cấu hình phân quyền</h5>
            </div>
            <button
              disabled={!(userProfile?.role === "admin" || userProfile?.permissions?.includes("*") || userProfile?.permissions?.includes("access:manage"))}
              onClick={() => {
                if (!(userProfile?.role === "admin" || userProfile?.permissions?.includes("*") || userProfile?.permissions?.includes("access:manage"))) return;
                setEditingRole(null);
                setRoleSlug("");
                setRoleDisplayName("");
                setRoleLevel(3);
                setSelectedPermissions([]);
                setIsRoleModalOpen(true);
              }}
              className="p-2 px-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold font-sans flex items-center gap-1.5 transition-all cursor-pointer shadow-xs active:scale-95 text-center justify-center"
            >
              <Plus className="h-3.5 w-3.5" />
              Thêm vai trò tùy chỉnh
            </button>
          </div>

          {roleLoading ? (
            <div className="h-48 flex flex-col items-center justify-center text-center">
              <RefreshCw className="h-8 w-8 text-indigo-650 animate-spin mb-3" />
              <span className="text-xs font-bold font-mono text-indigo-800 uppercase tracking-widest">Đang tải danh sách vai trò...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {/* Render Default roles and Custom roles */}
              {(() => {
                const DEFAULT_ROLE_PERMISSIONS: Record<string, string[]> = {
                  admin: ["*"],
                  branch_owner: ["access:read", "access:manage", "hr:read", "timekeeping:read", "timekeeping:manage", "people:read", "people:manage", "resource:read", "chat:read", "work:read", "work:manage"],
                  manager: [
                    "access:read", "access:manage",
                    "timekeeping:read", "timekeeping:manage",
                    "payroll-period:read",
                    "work:read", "work:manage",
                    "work:read", "work:manage",
                    "inventory:read", "inventory:manage",
                    "people:read", "people:manage",
                    "resource:read", "resource:manage",
                    "chat:read", "chat:manage",
                    "finance-receivable:read"
                  ],
                  user: [
                    "access:read",
                    "timekeeping:read",
                    "work:read", "work:manage",
                    "work:read",
                    "inventory:read",
                    "people:read",
                    "resource:read",
                    "chat:read",
                    "finance-receivable:read"
                  ],
                  teacher: ["people:read", "people:manage"]
                };

                const defaultRolesList = [
                  { role: "admin", displayName: getRoleDisplayName("admin"), level: 2, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.admin },
                  { role: "manager", displayName: getRoleDisplayName("manager"), level: 3, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.manager },
                  { role: "branch_owner", displayName: getRoleDisplayName("branch_owner"), level: 2, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.branch_owner },
                  { role: "teacher", displayName: getRoleDisplayName("teacher"), level: 4, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.teacher },
                  { role: "user", displayName: getRoleDisplayName("user"), level: 4, isDefault: true, permissions: DEFAULT_ROLE_PERMISSIONS.user }
                ];
                
                const customRolesList = rolePermissionsList.filter(rp => !["admin", "manager", "branch_owner", "teacher", "user"].includes(rp.role));
                
                const rolesToDisplay = [
                  ...defaultRolesList.map(dr => {
                    const dbRecord = rolePermissionsList.find(rp => rp.role === dr.role);
                    return {
                      ...dr,
                      permissions: dbRecord ? dbRecord.permissions : (DEFAULT_ROLE_PERMISSIONS[dr.role] || []),
                      displayName: dbRecord?.displayName || dr.displayName,
                      level: dbRecord?.level || dr.level,
                      _id: dbRecord?._id
                    };
                  }),
                  ...customRolesList.map(cr => ({
                    role: cr.role,
                    displayName: getRoleDisplayName(cr.role, cr.displayName),
                    level: cr.level,
                    permissions: cr.permissions,
                    isDefault: false,
                    _id: cr._id
                  }))
                ];

                const canEditRole = (roleInfo: { role: string; level: number }) => {
                  const currentRole = userProfile?.role;
                  if (!currentRole || roleInfo.role === "admin") return false;
                  return true;
                };

                return rolesToDisplay.map((roleInfo) => {
                  return (
                    <div key={roleInfo.role} className="bg-white border border-gray-150 hover:border-indigo-200 rounded-2xl p-5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between gap-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="px-2 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-bold font-mono tracking-wider">
                              LEVEL {roleInfo.level}
                            </span>
                            <h6 className="font-bold text-slate-800 text-sm mt-1">{roleInfo.displayName}</h6>
                            <span className="text-[10px] text-gray-400 font-mono block">Mã: {roleInfo.role}</span>
                          </div>
                          {roleInfo.isDefault && (
                            <span className="px-2 py-0.5 bg-blue-50 text-blue-700 border border-blue-150 rounded-sm text-[8px] font-bold font-mono">
                              MẶC ĐỊNH
                            </span>
                          )}
                        </div>

                        {/* Permissions display */}
                        <div className="space-y-1.5 text-left">
                          <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider block">Các quyền được cấp phép:</span>
                          <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                            {roleInfo.permissions.length === 0 ? (
                              <span className="text-[10px] text-gray-400 italic">Chưa cấu hình quyền nào</span>
                            ) : roleInfo.permissions.includes("*") ? (
                              <span className="px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-xl text-[10px] font-bold flex items-center gap-1">
                                ✓ Toàn quyền hệ thống
                              </span>
                            ) : (
                              roleInfo.permissions.map(p => {
                                const sysPerm = systemPermissions.find(sp => sp.code === p);
                                const labelText = getPermissionLabel(p, sysPerm?.name);
                                return (
                                  <span key={p} className="px-2 py-0.75 bg-indigo-50 text-indigo-800 border border-indigo-150 rounded-lg text-[10px] font-semibold" title={`Mã hệ thống: ${p}`}>
                                    {labelText}
                                  </span>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="border-t border-gray-100 pt-3 flex justify-end gap-2 mt-auto">
                        {canEditRole(roleInfo) && (
                          <button
                            onClick={() => {
                              setEditingRole(roleInfo as any);
                              setRoleSlug(roleInfo.role);
                              setRoleDisplayName(roleInfo.displayName);
                              setRoleLevel(roleInfo.level);
                              setSelectedPermissions(roleInfo.permissions);
                              setIsRoleModalOpen(true);
                            }}
                            className="p-1.5 px-3 bg-white hover:bg-slate-100 border border-gray-205 rounded-xl text-[10px] font-bold text-slate-700 cursor-pointer transition-all active:scale-95 flex items-center gap-1"
                          >
                            Thiết lập phân quyền
                          </button>
                        )}
                        {!roleInfo.isDefault && (
                          <button
                            onClick={() => handleDeleteRole(roleInfo)}
                            className="p-1.5 bg-red-50 hover:bg-red-100 border border-red-200 rounded-xl text-[10px] font-bold text-red-650 cursor-pointer transition-all active:scale-95"
                            title="Xóa vai trò"
                          >
                            Xóa
                          </button>
                        )}
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      )}

      <UserFormModal
        open={isUserModalOpen}
        onClose={() => {
          setIsUserModalOpen(false);
          resetUserForm();
        }}
        editingUser={editingUser}
        userDisplayName={userDisplayName}
        setUserDisplayName={setUserDisplayName}
        userCompanyName={userCompanyName}
        setUserCompanyName={setUserCompanyName}
        userIndustry={userIndustry}
        setUserIndustry={setUserIndustry}
        userEmail={userEmail}
        userPhone={userPhone}
        setUserPhone={setUserPhone}
        userBirthDate={userBirthDate}
        setUserBirthDate={setUserBirthDate}
        userPhotoURL={userPhotoURL}
        setUserPhotoURL={setUserPhotoURL}
        userCoverImage={userCoverImage}
        setUserCoverImage={setUserCoverImage}
        setUserEmail={setUserEmail}
        userPassword={userPassword}
        setUserPassword={setUserPassword}
        userRole={userRole}
        setUserRole={setUserRole}
        userCompanyCode={userCompanyCode}
        setUserCompanyCode={setUserCompanyCode}
        userBranchId={userBranchId}
        setUserBranchId={setUserBranchId}
        userParentId={userParentId}
        setUserParentId={setUserParentId}
        userDepartment={userDepartment}
        setUserDepartment={setUserDepartment}
        userQualification={userQualification}
        setUserQualification={setUserQualification}
        userJobDescriptionLink={userJobDescriptionLink}
        userMonthlySalary={userMonthlySalary}
        setUserMonthlySalary={setUserMonthlySalary}
        setUserJobDescriptionLink={setUserJobDescriptionLink}
        setUserJobDescriptionUploadToken={setUserJobDescriptionUploadToken}
        getAvailableRoles={getAvailableRoles}
        userProfile={userProfile}
        branches={branches}
        usersList={usersList}
        onSubmit={handleRegisterUser}
        submittingUser={submittingUser}
      />

      {/* Modern Delete User Modal */}
      <UserDeleteModal
        open={isDeleteUserModalOpen}
        onClose={() => {
          if (!deletingUser) {
            setIsDeleteUserModalOpen(false);
            setUserToDelete(null);
          }
        }}
        user={userToDelete}
        onConfirm={confirmDeleteUser}
        deleting={deletingUser}
      />

      <RoleModal
        open={isRoleModalOpen}
        onClose={() => setIsRoleModalOpen(false)}
        editingRole={editingRole}
        roleSlug={roleSlug}
        setRoleSlug={setRoleSlug}
        roleDisplayName={roleDisplayName}
        setRoleDisplayName={setRoleDisplayName}
        roleLevel={roleLevel}
        setRoleLevel={setRoleLevel}
        selectedPermissions={selectedPermissions}
        setSelectedPermissions={setSelectedPermissions}
        userProfile={userProfile}
        systemPermissions={systemPermissions}
        submittingRole={submittingRole}
        onSubmit={async (e) => {
          e.preventDefault();
          if (!roleSlug.trim() || !roleDisplayName.trim()) {
            toast.warning("Vui lòng nhập đầy đủ thông tin vai trò!");
            return;
          }

          setSubmittingRole(true);
          try {
            const code = userProfile?.companyCode;

            const payload = {
              role: roleSlug.toLowerCase().trim(),
              displayName: roleDisplayName.trim(),
              level: roleLevel,
              permissions: selectedPermissions,
              companyCode: code,
            };

            await rolePermissionService.saveRolePermission(payload);
            toast.success(editingRole ? "Cập nhật vai trò thành công!" : "Tạo vai trò mới thành công!");
            setIsRoleModalOpen(false);
            await fetchRolePermissions();
          } catch (error) {
            console.error(error);
            toast.error(error.message || "Không thể cập nhật cấu hình vai trò.");
          } finally {
            setSubmittingRole(false);
          }
        }}
      />

      {/* Custom confirm dialog */}
      {confirmState && (
        <ConfirmDialog
          isOpen={confirmState.isOpen}
          title={confirmState.title}
          description={confirmState.description}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          onClose={() => setConfirmState(null)}
          onConfirm={confirmState.onConfirm}
        />
      )}
    </div>
  );
}

