import React, { useState, useEffect, useRef } from "react";
import {
  Users,
  Search,
  Filter,
  Plus,
  Building2,
  Trash2,
  X,
  RefreshCw,
  Activity,
  Briefcase,
  MapPin,
  Phone,
  Mail,
  UserPlus,
  Maximize2,
  Minimize2,
  Edit,
  Link2,
  Upload,
  Eye,
  CalendarDays,
  List,
  Network
} from "lucide-react";
import { EmployeeNode, UserProfile, TrainingCourse } from "../../types";
import { authService, getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { filterOrgChartEmployees, getManagerForEmployee } from "./orgChartUtils";
import { useIsMobile } from "../../hooks/useMediaQuery";

interface OrgChartTabProps {
  userProfile: any;
  selectedCompanyCode: string;
  usersList: UserProfile[];
  employees: EmployeeNode[];
  fetchUsers: () => Promise<void>;
  isManager: boolean;
  companies: any[];
  courses: TrainingCourse[];
  fetchCourses: (compCode: string) => Promise<void>;
  loading: boolean;
  activeBranchId?: string;
}

const isUrl = (str?: string): boolean => {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/") || str.startsWith("/");
};

const normalizeString = (str: string): string => {
  return String(str ?? "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "d");
};

const parseDurationToHours = (durationStr: string): number => {
  if (!durationStr) return 0;
  const cleanStr = durationStr.toLowerCase().trim();
  const match = cleanStr.match(/(\d+(\.\d+)?)/);
  if (!match) return 0;
  const value = parseFloat(match[1]);

  if (cleanStr.includes("phut") || cleanStr.includes("m") || cleanStr.includes("minutes") || cleanStr.includes("minute")) {
    return Number((value / 60).toFixed(1));
  }
  return value;
};

const renderAvatar = (avatar: string, sizeClasses: string = "w-8 h-8", textClass: string = "text-base", nameFallback?: string) => {
  if (isUrl(avatar)) {
    return (
      <div className={`${sizeClasses} rounded-full overflow-hidden shrink-0 flex items-center justify-center border-2 border-white shadow-xs bg-slate-100`}>
        <img
          src={avatar}
          className="w-full h-full object-cover"
          alt={nameFallback || "Avatar thành viên"}
          onError={(e) => {
            const target = e.currentTarget;
            target.style.display = "none";
            const parent = target.parentElement;
            if (parent) {
              parent.classList.add("bg-gradient-to-tr", "from-red-600", "to-rose-500", "text-white", "font-bold");
              parent.innerText = nameFallback ? nameFallback.trim().charAt(0).toUpperCase() : "👤";
            }
          }}
        />
      </div>
    );
  }
  return (
    <div className={`${sizeClasses} bg-gradient-to-tr from-red-600 to-rose-500 text-white font-bold rounded-full shrink-0 flex items-center justify-center border-2 border-white shadow-xs select-none`}>
      <span className={textClass}>{nameFallback ? nameFallback.trim().charAt(0).toUpperCase() : (avatar || "👤")}</span>
    </div>
  );
};


const FUNCTIONAL_CATEGORIES = [
  { key: "governance", label: "Quản trị", badge: "GOVERNANCE", color: "bg-slate-900", border: "border-t-4 border-slate-900", dot: "#0f172a" },
  { key: "finance", label: "Tài chính - Pháp lý", badge: "FINANCE", color: "bg-emerald-500", border: "border-t-4 border-emerald-500", dot: "#10b981" },
  { key: "tech", label: "Hệ thống & Công nghệ", badge: "TECH", color: "bg-indigo-655", border: "border-t-4 border-indigo-650", dot: "#4f46e5" },
  { key: "operations", label: "Vận hành - Sản xuất", badge: "OPERATIONS", color: "bg-cyan-500", border: "border-t-4 border-cyan-500", dot: "#06b6d4" },
  { key: "sales", label: "Kinh doanh & Tiếp thị", badge: "SALES", color: "bg-amber-500", border: "border-t-4 border-amber-500", dot: "#f59e0b" },
  { key: "hr", label: "Hành chính & Nhân sự", badge: "HR", color: "bg-rose-500", border: "border-t-4 border-rose-500", dot: "#f43f5e" },
  { key: "other", label: "Khác", badge: "OTHER", color: "bg-slate-500", border: "border-t-4 border-slate-500", dot: "#64748b" }
];

const getCategoryByDivision = (division: string) => {
  const divLower = (division || "").toLowerCase();
  if (
    divLower.includes("quản trị") ||
    divLower.includes("giám đốc") ||
    divLower.includes("governance") ||
    divLower.includes("ceo") ||
    divLower.includes("coo") ||
    divLower.includes("hội đồng") ||
    divLower.includes("kiểm soát")
  ) {
    return FUNCTIONAL_CATEGORIES[0];
  }
  if (
    divLower.includes("tài chính") ||
    divLower.includes("kế toán") ||
    divLower.includes("pháp lý") ||
    divLower.includes("finance") ||
    divLower.includes("legal")
  ) {
    return FUNCTIONAL_CATEGORIES[1];
  }
  if (
    divLower.includes("kỹ thuật") ||
    divLower.includes("công nghệ") ||
    divLower.includes("hệ thống") ||
    divLower.includes("tech") ||
    divLower.includes("it") ||
    divLower.includes("phần mềm") ||
    divLower.includes("software")
  ) {
    return FUNCTIONAL_CATEGORIES[2];
  }
  if (
    divLower.includes("vận hành") ||
    divLower.includes("sản xuất") ||
    divLower.includes("kho") ||
    divLower.includes("operations") ||
    divLower.includes("logistics")
  ) {
    return FUNCTIONAL_CATEGORIES[3];
  }
  if (
    divLower.includes("kinh doanh") ||
    divLower.includes("tiếp thị") ||
    divLower.includes("sales") ||
    divLower.includes("marketing") ||
    divLower.includes("csm") ||
    divLower.includes("cso") ||
    divLower.includes("thương mại")
  ) {
    return FUNCTIONAL_CATEGORIES[4];
  }
  if (
    divLower.includes("nhân sự") ||
    divLower.includes("hành chính") ||
    divLower.includes("hr") ||
    divLower.includes("admin") ||
    divLower.includes("tuyển dụng") ||
    divLower.includes("đào tạo")
  ) {
    return FUNCTIONAL_CATEGORIES[5];
  }
  return FUNCTIONAL_CATEGORIES[5];
};

export default function OrgChartTab({
  userProfile,
  selectedCompanyCode,
  usersList,
  employees,
  fetchUsers,
  isManager,
  companies,
  courses,
  fetchCourses,
  loading,
  activeBranchId,
}: OrgChartTabProps) {
  const isMobile = useIsMobile();
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [isFitted, setIsFitted] = useState<boolean>(false);
  const [preFitZoom, setPreFitZoom] = useState<number>(1);
  const [isSafari, setIsSafari] = useState<boolean>(false);
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [startY, setStartY] = useState(0);
  const [scrollLeftState, setScrollLeftState] = useState(0);
  const [scrollTopState, setScrollTopState] = useState(0);

  const toggleFitScreen = () => {
    if (!containerRef.current) return;
    const child = containerRef.current.firstElementChild as HTMLElement;
    if (!child) return;

    if (isFitted) {
      setZoomLevel(preFitZoom);
      setIsFitted(false);

      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = (containerRef.current.scrollWidth - containerRef.current.clientWidth) / 2;
          containerRef.current.scrollTop = (containerRef.current.scrollHeight - containerRef.current.clientHeight) / 2;
        }
      }, 50);
    } else {
      setPreFitZoom(zoomLevel);

      const rect = child.getBoundingClientRect();
      const unscaledWidth = rect.width / zoomLevel;
      const unscaledHeight = rect.height / zoomLevel;

      const padding = 40;
      const viewWidth = containerRef.current.clientWidth - padding;
      const viewHeight = containerRef.current.clientHeight - padding;

      const fitWidthScale = viewWidth / unscaledWidth;
      const fitHeightScale = viewHeight / unscaledHeight;
      let targetZoom = Math.min(fitWidthScale, fitHeightScale);

      targetZoom = Math.max(0.2, Math.min(1.5, targetZoom));
      targetZoom = Number(targetZoom.toFixed(2));

      setZoomLevel(targetZoom);
      setIsFitted(true);

      setTimeout(() => {
        if (containerRef.current) {
          containerRef.current.scrollLeft = (containerRef.current.scrollWidth - containerRef.current.clientWidth) / 2;
          containerRef.current.scrollTop = (containerRef.current.scrollHeight - containerRef.current.clientHeight) / 2;
        }
      }, 50);
    }
  };

  const hasDragMovedRef = useRef(false);

  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest("button") ||
      target.closest("select") ||
      target.closest("input") ||
      target.closest("[draggable='true']")
    ) {
      return;
    }
    hasDragMovedRef.current = false;
    if (containerRef.current) {
      setStartX(e.pageX - containerRef.current.offsetLeft);
      setStartY(e.pageY - containerRef.current.offsetTop);
      setScrollLeftState(containerRef.current.scrollLeft);
      setScrollTopState(containerRef.current.scrollTop);
    }
    setIsDragging(true);
  };

  const handleMouseLeaveOrUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging || !containerRef.current) return;
    e.preventDefault();
    const x = e.pageX - containerRef.current.offsetLeft;
    const y = e.pageY - containerRef.current.offsetTop;
    const walkX = (x - startX) * 1.5;
    const walkY = (y - startY) * 1.5;
    // Only activate panning after moving more than 5px (prevents click suppression on laptop trackpads)
    if (!hasDragMovedRef.current && Math.abs(walkX) < 5 && Math.abs(walkY) < 5) return;
    hasDragMovedRef.current = true;
    containerRef.current.scrollLeft = scrollLeftState - walkX;
    containerRef.current.scrollTop = scrollTopState - walkY;
  };

  // Lắng nghe sự kiện wheel với passive: false để chặn touchpad/trackpad zoom toàn trang
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const zoomFactor = e.deltaY < 0 ? 0.05 : -0.05;
      setIsFitted(false);
      setZoomLevel((prev) => Math.max(0.3, Math.min(1.8, Number((prev + zoomFactor).toFixed(2)))));
    };

    container.addEventListener("wheel", handleNativeWheel, { passive: false });
    return () => {
      container.removeEventListener("wheel", handleNativeWheel);
    };
  }, []);

  const [filterDepartment, setFilterDepartment] = useState<string>("Tất cả");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());
  const [selectedEmp, setSelectedEmp] = useState<EmployeeNode | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [activeDropdownCardId, setActiveDropdownCardId] = useState<string | null>(null);
  const [selectedLeaveBalance, setSelectedLeaveBalance] = useState<any>(null);
  const [viewMode, setViewMode] = useState<"tree" | "list">("tree");
  const [listPage, setListPage] = useState<number>(1);
  const listLimit = 10;

  useEffect(() => {
    setListPage(1);
  }, [searchQuery, filterDepartment]);

  useEffect(() => {
    if (!selectedEmp || !selectedCompanyCode) {
      setSelectedLeaveBalance(null);
      return;
    }
    const loadLeaveBalance = async () => {
      try {
        const res = await fetch(`/api/v1/leave/balance?employeeId=${encodeURIComponent(selectedEmp.id)}&year=${new Date().getFullYear()}`, { headers: { Authorization: `Bearer ${getAccessToken()}` } });
        if (res.ok) setSelectedLeaveBalance((await res.json()).data || null);
      } catch (error) { console.error("Không thể tải số phép nhân viên", error); }
    };
    loadLeaveBalance();
  }, [selectedEmp?.id, selectedCompanyCode]);

  useEffect(() => {
    if (selectedEmp) {
      setIsDetailModalOpen(true);
    } else {
      setIsDetailModalOpen(false);
    }
  }, [selectedEmp?.id]);

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedEmp(null);
    setSelectedLeaveBalance(null);
    setIsEditing(false);
  };

  const getDirectSubordinates = (nodeId: string): EmployeeNode[] => {
    return employees.filter(e => e.parentId === nodeId);
  };

  // Add Member Modal States
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isAddingEmployee, setIsAddingEmployee] = useState(false);
  const [addName, setAddName] = useState("");
  const [addEmail, setAddEmail] = useState("");
  const [addPassword, setAddPassword] = useState("");
  const [addPhone, setAddPhone] = useState("");
  const [addCompanyName, setAddCompanyName] = useState("");
  const [addIndustry, setAddIndustry] = useState("");
  const [addDepartment, setAddDepartment] = useState("Ban Thành viên");
  const [addParentId, setAddParentId] = useState("");
  const [addRole, setAddRole] = useState<"user" | "manager" | "branch_owner" | "admin">("user");
  const [addPhotoURL, setAddPhotoURL] = useState("");

  // Edit Member States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editRoleText, setEditRoleText] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editDepartment, setEditDepartment] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editPhotoURL, setEditPhotoURL] = useState("");
  const [editParentId, setEditParentId] = useState("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingLeader, setIsSavingLeader] = useState(false);

  // Reset editing state when selected employee changes
  useEffect(() => {
    setIsEditing(false);
  }, [selectedEmp?.id]);

  const startEditing = () => {
    if (!selectedEmp) return;
    const raw = usersList.find(u => u.uid === selectedEmp.id);
    setEditName(raw?.displayName || selectedEmp.name || "");
    setEditRoleText(raw?.jobTitle || selectedEmp.role || "");
    setEditCompanyName(raw?.companyName || selectedEmp.companyName || "");
    setEditIndustry(raw?.industry || selectedEmp.industry || "");
    setEditDepartment(raw?.department || selectedEmp.department || "");
    setEditEmail(raw?.email || selectedEmp.email || "");
    setEditPhone(raw?.phone && raw.phone !== "Chưa cập nhật" ? raw.phone : (selectedEmp.phone && selectedEmp.phone !== "Chưa cập nhật" ? selectedEmp.phone : ""));
    setEditParentId(raw?.parentId || selectedEmp.parentId || "");
    setEditPhotoURL(raw?.photoURL || selectedEmp.avatar || "");
    setEditBirthDate(
      raw?.birthDate
        ? (typeof raw.birthDate === "string" ? raw.birthDate.split("T")[0] : new Date(raw.birthDate).toISOString().split("T")[0])
        : (selectedEmp.birthDate ? selectedEmp.birthDate.split("T")[0] : "")
    );
    setIsEditing(true);
  };

  const handleAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAvatar(true);
    try {
      const res = await authService.uploadAvatar(file);
      setEditPhotoURL(res.url);
      toast.success("Đã tải lên ảnh đại diện.");
    } catch (err: any) {
      toast.error(err?.message || "Không thể tải lên ảnh đại diện.");
    } finally {
      setUploadingAvatar(false);
    }
  };


  const handleToggleLeader = async () => {
    if (!selectedEmp) return;
    try {
      setIsSavingLeader(true);
      const newLeaderState = !selectedEmp.isLeader;
      await authService.updateUser(selectedEmp.id, { isLeader: newLeaderState });
      toast.success(
        newLeaderState
          ? `Đã đặt ${selectedEmp.name} làm Trưởng nhóm (Leader) phòng ban!`
          : `Đã hủy chức vụ Trưởng nhóm (Leader) của ${selectedEmp.name}!`
      );
      setSelectedEmp(prev => prev ? { ...prev, isLeader: newLeaderState } : null);
      await fetchUsers();
    } catch (err) {
      console.error("Lỗi cập nhật chức danh leader:", err);
      toast.error(getApiErrorMessage(err, "Không thể cập nhật chức vụ Trưởng nhóm."));
    } finally {
      setIsSavingLeader(false);
    }
  };

  const handleJobDescriptionFileChange = async (e: React.ChangeEvent<HTMLInputElement>, target: "add" | "edit") => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    const setUploading = target === "add" ? setUploadingAddJobDescription : setUploadingEditJobDescription;
    const setLink = target === "add" ? setAddJobDescriptionLink : setEditJobDescriptionLink;
    const setToken = target === "add" ? setAddJobDescriptionUploadToken : setEditJobDescriptionUploadToken;

    setUploading(true);
    try {
      const uploaded = await authService.uploadManagedFile(file, "hr.org-chart", selectedCompanyCode || userProfile?.companyCode);
      setLink(uploaded.url);
      setToken(uploaded.uploadToken);
      toast.success("Đã tải lên mô tả công việc.");
    } catch (error: any) {
      toast.error(error?.message || "Tải file mô tả công việc lên Cloudinary thất bại.");
    } finally {
      setUploading(false);
    }
  };

  const handleEditEmployeeSave = async () => {
    if (!selectedEmp) return;

    if (!editName.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Họ tên!");
      return;
    }

    if (editPhone.trim()) {
      const phoneNormalized = editPhone.trim().replace(/\s+/g, "");
      const duplicatePhone = usersList.find(u => u.uid !== selectedEmp.id && u.phone && u.phone.replace(/\s+/g, "") === phoneNormalized);
      if (duplicatePhone) {
        toast.error(`❌ Số điện thoại "${editPhone.trim()}" đã được sử dụng bởi thành viên khác!`);
        return;
      }
    }

    setIsSaving(true);
    try {
      const updateData: any = {
        displayName: editName.trim(),
        jobTitle: editRoleText.trim(),
        companyName: editCompanyName.trim(),
        industry: editIndustry.trim(),
        department: editDepartment.trim(),
        phone: editPhone.trim() || "",
        parentId: editParentId || null,
        photoURL: editPhotoURL.trim() || undefined,
        birthDate: editBirthDate || undefined,
      };

      await authService.updateUser(selectedEmp.id, updateData);
      toast.success("Cập nhật thông tin thành viên thành công!");
      setIsEditing(false);
      await fetchUsers();

      // Cập nhật selectedEmp cục bộ
      setSelectedEmp((prev) => prev ? {
        ...prev,
        name: updateData.displayName,
        role: updateData.jobTitle,
        companyName: updateData.companyName,
        industry: updateData.industry,
        department: updateData.department,
        phone: updateData.phone || "Chưa cập nhật",
        parentId: updateData.parentId || undefined,
        avatar: updateData.photoURL || prev.avatar,
        birthDate: updateData.birthDate,
      } : null);
    } catch (err) {
      console.error(err);
      toast.error(getApiErrorMessage(err, "Lỗi khi cập nhật thông tin thành viên."));
    } finally {
      setIsSaving(false);
    }
  };


  const canEditEmployee = (selectedEmpId: string): boolean => {
    if (!userProfile) return false;
    if (selectedEmpId === userProfile.uid) {
      // Cho phép admin và manager tự chỉnh sửa thông tin của chính mình
      return ["admin", "manager"].includes(userProfile.role);
    }

    const selectedUserRaw = usersList.find(u => u.uid === selectedEmpId);
    if (!selectedUserRaw) return false;

    if (selectedUserRaw.companyCode !== userProfile.companyCode) return false;

    const rolesHierarchy = {
      admin: 3,
      manager: 2,
      user: 1
    };

    const currentUserWeight = rolesHierarchy[userProfile.role as keyof typeof rolesHierarchy] || 0;
    const selectedUserWeight = rolesHierarchy[selectedUserRaw.role as keyof typeof rolesHierarchy] || 0;

    return currentUserWeight >= selectedUserWeight;
  };

  const toggleCollapse = (nodeId: string) => {
    setCollapsedNodes(prev => {
      const next = new Set(prev);
      if (next.has(nodeId)) next.delete(nodeId);
      else next.add(nodeId);
      return next;
    });
  };

  const collapseAll = () => {
    const nodesWithChildren = new Set(
      employees
        .filter(e => employees.some(c => c.parentId === e.id))
        .map(e => e.id)
    );
    setCollapsedNodes(nodesWithChildren);
  };

  const expandAll = () => setCollapsedNodes(new Set());

  const canDeleteEmployee = (selectedEmpId: string): boolean => {
    if (!userProfile) return false;
    if (selectedEmpId === userProfile.uid) return false; // Không tự xóa chính mình

    const selectedUserRaw = usersList.find(u => u.uid === selectedEmpId);
    if (!selectedUserRaw) return false;

    const rolesHierarchy = {
      admin: 3,
      manager: 2,
      user: 1
    };

    const currentUserWeight = rolesHierarchy[userProfile.role as keyof typeof rolesHierarchy] || 0;
    const selectedUserWeight = rolesHierarchy[selectedUserRaw.role as keyof typeof rolesHierarchy] || 0;

    return currentUserWeight > selectedUserWeight;
  };

  const deleteEmployeeConfirmed = async (empId: string) => {
    try {
      await authService.deleteUser(empId);
      toast.success("Đã xóa thành viên thành công!");
      setSelectedEmp(null);
      await fetchUsers();
    } catch (error) {
      console.error("Lỗi khi xóa thành viên:", error);
      toast.error(getApiErrorMessage(error, "Không thể xóa thành viên. Vui lòng kiểm tra quyền hạn."));
    }
  };

  const handleDeleteEmployeeSubmit = (empId: string) => {
    const targetEmp = employees.find(e => e.id === empId);
    if (!targetEmp) return;

    askConfirm(
      "Xóa thành viên này?",
      `Bạn có chắc chắn muốn xóa thành viên "${targetEmp.name}" khỏi hệ thống? Sơ đồ sẽ tự động chuyển cấp dưới trực thuộc của thành viên này báo cáo lên quản lý cấp trên.`,
      () => deleteEmployeeConfirmed(empId),
      "Xóa thành viên",
      "Hủy"
    );

  };

  useEffect(() => {
    const ua = navigator.userAgent.toLowerCase();
    const isSaf = ua.includes("safari") && !ua.includes("chrome") && !ua.includes("chromium");
    setIsSafari(isSaf);
  }, []);

  // Set default parentId when add employee modal is opened
  useEffect(() => {
    if (isAddModalOpen) {
      setAddRole("user");
      if (userProfile?.role === "manager") {
        setAddParentId(userProfile.uid);
      } else {
        const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
        const firstCompanyManager = usersList.find(
          (u) => u.companyCode === compCode && u.role === "manager"
        );
        const firstBranchOwner = usersList.find(
          (u) => u.companyCode === compCode && u.role === "branch_owner"
        );
        const firstAdmin = usersList.find(
          (u) => u.companyCode === compCode && u.role === "admin"
        );
        setAddParentId(firstCompanyManager?.uid || firstBranchOwner?.uid || firstAdmin?.uid || "");
      }
    }
  }, [isAddModalOpen, userProfile, selectedCompanyCode, usersList]);

  // Handle parentId based on addRole automatically
  useEffect(() => {
    if (isAddModalOpen) {
      const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
      if (addRole === "admin") {
        setAddParentId("");
      } else if (addRole === "branch_owner") {
        const companyAdmin = usersList.find(
          (u) => u.companyCode === compCode && u.role === "admin"
        );
        setAddParentId(companyAdmin?.uid || "");
      } else if (addRole === "manager") {
        const branchOwner = usersList.find(
          (u) => u.companyCode === compCode && u.role === "branch_owner"
        );
        const companyAdmin = usersList.find(
          (u) => u.companyCode === compCode && u.role === "admin"
        );
        setAddParentId(branchOwner?.uid || companyAdmin?.uid || "");
      } else { // addRole === "user"
        if (userProfile?.role === "manager") {
          setAddParentId(userProfile.uid);
        } else {
          const firstCompanyManager = usersList.find(
            (u) => u.companyCode === compCode && u.role === "manager"
          );
          const branchOwner = usersList.find(
            (u) => u.companyCode === compCode && u.role === "branch_owner"
          );
          const companyAdmin = usersList.find(
            (u) => u.companyCode === compCode && u.role === "admin"
          );
          setAddParentId(firstCompanyManager?.uid || branchOwner?.uid || companyAdmin?.uid || "");
        }
      }
    }
  }, [addRole, isAddModalOpen, selectedCompanyCode, userProfile, usersList]);

  // Auto fill department based on manager (addParentId)
  useEffect(() => {
    if (isAddModalOpen && addRole === "user" && addParentId) {
      const selectedManager = usersList.find(u => u.uid === addParentId);
      if (selectedManager && selectedManager.department) {
        setAddDepartment(selectedManager.department);
      }
    } else if (isAddModalOpen && addRole === "user" && !addParentId) {
      setAddDepartment("");
    }
  }, [addRole, addParentId, usersList, isAddModalOpen]);

  // Reset addDepartment when modal closes
  useEffect(() => {
    if (!isAddModalOpen) {
      setAddDepartment("Phòng Kỹ Thuật");
      setAddJobDescriptionLink("");
      setAddJobDescriptionUploadToken("");
    }
  }, [isAddModalOpen]);



  // Tự động gán khóa học Onboarding / Bắt buộc + tạo Kanban task khi thêm nhân viên mới
  const autoAssignCourseOnNewEmployee = async (newEmpUid: string, newEmpName: string, companyCode: string) => {
    const targetCourses = courses.filter(c => (c.autoAssignOnboarding || c.isRequired) && c.companyCode === companyCode);
    for (const course of targetCourses) {
      try {
        // Tạo enrollment
        await fetch("/api/v1/crud/training-enrollments", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            courseId: course.id,
            courseTitle: course.title,
            uid: newEmpUid,
            userName: newEmpName,
            companyCode,
            progress: 0,
            status: "in_progress",
            createdAt: new Date().toISOString(),
            startedAt: new Date().toISOString(),
            completedLessons: [],
            quizPassed: false,
          }),
        });

        // Tăng enrolledCount trên khóa học
        await fetch(`/api/v1/crud/training-courses/${course.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${getAccessToken()}`,
          },
          body: JSON.stringify({
            enrolledCount: (course.enrolledCount || 0) + 1
          }),
        });
      } catch (err) {
        console.error(`Lỗi auto-assign course ${course.id}:`, err);
      }
    }
  };

  // Handle adding new employee user profile
  const handleAddEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addName.trim() || !addEmail.trim() || !addPassword.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Họ tên, Email và Mật khẩu!");
      return;
    }
    if (addPassword.length < 6) {
      toast.warning("Mật khẩu phải chứa ít nhất 6 ký tự!");
      return;
    }

    // Kiểm tra định dạng Email
    const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    if (!emailRegex.test(addEmail.trim())) {
      toast.warning("Địa chỉ email không đúng định dạng!");
      return;
    }

    // Kiểm tra định dạng Số điện thoại Việt Nam (nếu nhập)
    if (addPhone.trim()) {
      const vnPhoneRegex = /^(0|\+84|84)(3|5|7|8|9)[0-9]{8}$/;
      if (!vnPhoneRegex.test(addPhone.trim().replace(/\s+/g, ""))) {
        toast.warning("Số điện thoại Việt Nam không đúng định dạng (ví dụ: 0987654321)!");
        return;
      }
    }

    // Kiểm tra email trùng trong công ty
    const emailNormalized = addEmail.trim().toLowerCase();
    const duplicateEmail = usersList.find(u => u.email?.toLowerCase() === emailNormalized);
    if (duplicateEmail) {
      toast.error(`❌ Email "${addEmail.trim()}" đã được sử dụng bởi thành viên "${duplicateEmail.displayName || duplicateEmail.email}". Vui lòng dùng email khác!`);
      return;
    }

    // Kiểm tra số điện thoại trùng (nếu có nhập)
    if (addPhone.trim()) {
      const phoneNormalized = addPhone.trim().replace(/\s+/g, "");
      const duplicatePhone = usersList.find(u => u.phone && u.phone.replace(/\s+/g, "") === phoneNormalized);
      if (duplicatePhone) {
        toast.error(`❌ Số điện thoại "${addPhone.trim()}" đã được sử dụng bởi thành viên "${duplicatePhone.displayName || duplicatePhone.email}". Vui lòng dùng số khác!`);
        return;
      }
    }

    const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
    const compName = userProfile?.companyName || "";

    const manager = addParentId ? employees.find(emp => emp.id === addParentId) : undefined;
    const managerLevel = manager ? manager.level : undefined;
    const isDeptScopedRole = addRole === "user" || addRole === "manager";
    const deptName = isDeptScopedRole ? (addDepartment.trim() || (addRole === "manager" ? "Quản lý" : "Nhân sự")) : undefined;

    const finalCompName = addCompanyName.trim() || compName;
    try {
      setIsAddingEmployee(true);
      const newUid = await authService.registerUserForCompany(
        addName.trim(),
        addEmail.trim(),
        addPassword,
        addRole,
        compCode,
        finalCompName,
        addParentId || undefined,
        managerLevel,
        deptName,
        deptName,
        addPhone.trim(),
        undefined,
        undefined,
        activeBranchId || undefined,
        undefined,
        undefined,
        undefined,
        undefined,
        {
          industry: addIndustry.trim() || undefined,
          photoURL: addPhotoURL.trim() || undefined,
        }
      );

      toast.success(`Đã thêm thành viên "${addName}" thành công!`);

      // Tự động gán khóa học Onboarding + tạo Kanban task
      await autoAssignCourseOnNewEmployee(newUid, addName.trim(), compCode);

      setIsAddModalOpen(false);

      // Reset Form
      setAddName("");
      setAddEmail("");
      setAddPassword("");
      setAddPhone("");
      setAddCompanyName("");
      setAddIndustry("");
      setAddPhotoURL("");
      setAddParentId("");
      setAddRole("user");
      setAddDepartment("Ban Thành viên");

      await fetchUsers();
      if (compCode) {
        await fetchCourses(compCode);
      }
    } catch (err) {

      console.error(err);
      toast.error(getApiErrorMessage(err, "Lỗi khi thêm thành viên mới."));
    } finally {
      setIsAddingEmployee(false);
    }
  };

  // Drag & Drop logic for reorganizing reporting structures
  const handleDragStart = (e: React.DragEvent, id: string) => {
    const isAdmin = userProfile?.role === "admin";
    const isRoleManager = userProfile?.role === "manager";

    if (!isAdmin && !isRoleManager) {
      e.preventDefault();
      return;
    }

    // Nếu là manager, chỉ cho phép kéo nhân viên thuộc nhánh con của mình
    if (isRoleManager) {
      if (id === userProfile?.uid) {
        toast.warning("Bạn không thể tự kéo thả chính mình!");
        e.preventDefault();
        return;
      }

      const checkIsDescendant = (parentId: string, childId: string): boolean => {
        const child = employees.find(emp => emp.id === childId);
        if (!child || !child.parentId) return false;
        if (child.parentId === parentId) return true;
        return checkIsDescendant(parentId, child.parentId);
      };

      if (!checkIsDescendant(userProfile.uid, id)) {
        toast.warning("Bạn chỉ có quyền thuyên chuyển thành viên thuộc nhánh do mình quản lý!");
        e.preventDefault();
        return;
      }
    }

    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent) => {
    if (!isManager) return;
    e.preventDefault();
  };

  const handleDrop = async (e: React.DragEvent, targetId: string) => {
    e.preventDefault();
    const isAdmin = userProfile?.role === "admin";
    const isRoleManager = userProfile?.role === "manager";

    if (!isAdmin && !isRoleManager) {
      toast.warning("Bạn không có quyền thuyên chuyển thành viên!");
      return;
    }

    const draggedId = e.dataTransfer.getData("text/plain");
    if (!draggedId || draggedId === targetId) return;

    // Check circular dependencies helper
    const checkIsDescendant = (parentId: string, childId: string): boolean => {
      const child = employees.find(emp => emp.id === childId);
      if (!child || !child.parentId) return false;
      if (child.parentId === parentId) return true;
      return checkIsDescendant(parentId, child.parentId);
    };

    // Manager specific rules
    if (isRoleManager && userProfile) {
      const isTargetValid = targetId === userProfile.uid || checkIsDescendant(userProfile.uid, targetId);
      const isDraggedValid = checkIsDescendant(userProfile.uid, draggedId);

      if (!isDraggedValid) {
        toast.error("Không thể thuyên chuyển: Thành viên được chọn không nằm trong nhánh quản lý của bạn!");
        return;
      }
      if (!isTargetValid) {
        toast.error("Không thể thuyên chuyển: Người quản lý mới phải thuộc phạm vi nhánh do bạn quản lý!");
        return;
      }
    }

    if (checkIsDescendant(draggedId, targetId)) {
      toast.error("Không thể điều chuyển: Người quản lý mới không được là cấp dưới của thành viên này!");
      return;
    }

    const draggedEmp = employees.find(emp => emp.id === draggedId);
    const targetEmp = employees.find(emp => emp.id === targetId);

    if (!draggedEmp || !targetEmp) return;

    if (draggedEmp.level === 1) {
      toast.warning("CEO không thể điều chuyển báo cáo cho người khác!");
      return;
    }

    // Helper function to dynamically update hierarchy in state list
    const updateHierarchy = (list: EmployeeNode[], dragged: string, target: string): EmployeeNode[] => {
      const parent = list.find(emp => emp.id === target);
      if (!parent) return list;

      const newLevel = parent.level + 1;

      const nextList = list.map(emp => {
        if (emp.id === dragged) {
          return { ...emp, parentId: target, level: newLevel };
        }
        return emp;
      });

      const adjust = (currentList: EmployeeNode[]): EmployeeNode[] => {
        let changed = false;
        const updated = currentList.map(emp => {
          if (emp.parentId) {
            const p = currentList.find(parentEmp => parentEmp.id === emp.parentId);
            if (p && emp.level !== p.level + 1) {
              changed = true;
              return { ...emp, level: p.level + 1 };
            }
          }
          return emp;
        });
        return changed ? adjust(updated) : updated;
      };

      return adjust(nextList);
    };

    const updatedEmployees = updateHierarchy(employees, draggedId, targetId);

    try {
      const updates = updatedEmployees
        .filter(emp => {
          const original = employees.find(o => o.id === emp.id);
          return original && (original.parentId !== emp.parentId || original.level !== emp.level);
        })
        .map(emp => ({
          id: emp.id,
          parentId: emp.parentId || null,
          level: emp.level
        }));

      if (updates.length > 0) {
        await authService.bulkUpdateUsers(updates);
      }
      toast.success(`Đã điều chuyển ${draggedEmp.name} báo cáo cho ${targetEmp.name}. Quyền hệ thống được đồng bộ.`);
      await fetchUsers();
    } catch (err) {
      console.error("Lỗi cập nhật cơ cấu:", err);
      toast.error(getApiErrorMessage(err, "Không thể lưu cập nhật cơ cấu thành viên."));
    }
  };

  // Division Tag color schemes — dynamic, using FUNCTIONAL_CATEGORIES
  const getDivisionBadgeStyles = (division: string) => {
    const cat = getCategoryByDivision(division);
    switch (cat.key) {
      case "governance": return "bg-slate-100 text-slate-800 border-slate-300";
      case "finance": return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "tech": return "bg-indigo-50 text-indigo-700 border-indigo-200";
      case "operations": return "bg-cyan-50 text-cyan-700 border-cyan-200";
      case "sales": return "bg-amber-50 text-amber-700 border-amber-200";
      case "hr": return "bg-rose-50 text-rose-700 border-rose-200";
      default: return "bg-slate-50 text-slate-700 border-slate-200";
    }
  };

  // Danh sách phân khối động lấy từ dữ liệu nhân sự kết hợp các khối mặc định
  const uniqueDivisions = Array.from(
    new Set([
      "Khối Kỹ Thuật",
      "Khối Vận Hành",
      "Khối Marketing",
      "Khối Sales",
      ...employees.map(e => e.division).filter(Boolean)
    ])
  ).sort();

  // Danh sách phòng ban động lấy từ dữ liệu nhân sự hiện có của công ty (không fix cứng)
  const uniqueDepartments = Array.from(
    new Set(employees.map(e => e.department).filter(Boolean))
  ).sort();

  // Filtering matching logic
  const isMatchingFilter = (emp: EmployeeNode): boolean => {
    const query = normalizeString(searchQuery);
    const matchSearch = query === "" ||
      normalizeString(emp.name).includes(query) ||
      normalizeString(emp.role).includes(query) ||
      normalizeString(emp.department).includes(query);

    const matchDepartment = filterDepartment === "Tất cả" || emp.department === filterDepartment;

    return matchSearch && matchDepartment;
  };

  // Auto-arrange employees without parentId into the correct hierarchy based on role
  const arrangedEmployees = (() => {
    const ROLE_LEVEL: Record<string, number> = {
      admin: 1,
      branch_owner: 2,
      manager: 3,
      user: 4,
    };

    // Build a mutable copy with virtual parentId for rendering
    const list = employees.map(e => ({ ...e }));

    list.forEach(emp => {
      // If already has a valid parentId that exists, skip
      if (emp.parentId && list.some(p => p.id === emp.parentId)) return;

      const myLevel = ROLE_LEVEL[usersList.find(u => u.uid === emp.id)?.role ?? "user"] ?? 4;

      // Find the best parent: highest-level employee that is strictly above this one
      let bestParent: typeof list[0] | undefined;

      for (let targetLevel = myLevel - 1; targetLevel >= 0; targetLevel--) {
        const candidates = list.filter(p => {
          const pRole = usersList.find(u => u.uid === p.id)?.role ?? "user";
          return ROLE_LEVEL[pRole] === targetLevel && p.id !== emp.id;
        });
        if (candidates.length > 0) {
          bestParent = candidates[0];
          break;
        }
      }

      if (bestParent) {
        emp.parentId = bestParent.id;
      } else {
        // This employee is truly at the top
        emp.parentId = undefined;
      }
    });

    return list;
  })();

  // Identify root employees (nodes with no parent in the arranged tree)
  const rootEmployees = arrangedEmployees.filter(e => !e.parentId || !arrangedEmployees.some(p => p.id === e.parentId))
    .sort((a, b) => (a.level ?? 99) - (b.level ?? 99));
  const visibleEmployees = filterOrgChartEmployees(employees, searchQuery, filterDepartment);
  const paginatedEmployees = visibleEmployees.slice((listPage - 1) * listLimit, listPage * listLimit);
  const missingValue = "Chưa cập nhật";

  // Recursive Branch rendering component helper
  const renderBranch = (node: EmployeeNode) => {
    const children = arrangedEmployees.filter(e => e.parentId === node.id);
    const isSelected = selectedEmp?.id === node.id;
    const isMatch = isMatchingFilter(node);
    const isFilteredOut = (searchQuery.trim() !== "" || filterDepartment !== "Tất cả") && !isMatch;
    const isCollapsed = collapsedNodes.has(node.id);
    const directReportsCount = employees.filter(e => e.parentId === node.id).length;

    const category = getCategoryByDivision(node.division);

    const getCategoryBadgeStyles = (key: string) => {
      switch (key) {
        case "governance": return "bg-slate-100 text-slate-800 border-slate-200";
        case "finance": return "bg-emerald-50 text-emerald-700 border-emerald-200";
        case "tech": return "bg-indigo-50 text-indigo-700 border-indigo-200";
        case "operations": return "bg-cyan-50 text-cyan-700 border-cyan-200";
        case "sales": return "bg-amber-50 text-amber-700 border-amber-200";
        case "hr": return "bg-rose-50 text-rose-700 border-rose-200";
        default: return "bg-slate-50 text-slate-655 border-slate-200";
      }
    };

    const renderCardIcon = (role: string) => {
      const rLower = (role || "").toLowerCase();
      if (rLower.includes("ceo") || rLower.includes("chủ tịch") || rLower.includes("coo") || rLower.includes("cfo") || rLower.includes("cmo") || rLower.includes("cso") || rLower.includes("director") || rLower.includes("giám đốc")) {
        return "👑";
      }
      if (rLower.includes("trưởng phòng") || rLower.includes("manager") || rLower.includes("leader") || rLower.includes("trưởng nhóm")) {
        return "💼";
      }
      return "👤";
    };

    return (
      <div className="flex flex-col items-center" key={node.id}>
        {/* Smart Employee Card */}
        <div
          draggable={isManager ? "true" : "false"}
          onDragStart={(e) => handleDragStart(e, node.id)}
          onDragOver={handleDragOver}
          onDrop={(e) => handleDrop(e, node.id)}
          onClick={() => setSelectedEmp(node)}
          onMouseLeave={() => setActiveDropdownCardId(null)}
          className={`p-3 bg-white text-gray-800 rounded-2xl shadow-xs text-left cursor-pointer relative hover:scale-104 active:scale-95 transition-all duration-300 border border-gray-200 ${category.border} ${isSelected
            ? "ring-4 ring-indigo-500 shadow-indigo-100 border-transparent z-10"
            : "hover:border-indigo-300 hover:shadow-md"
            } ${isFilteredOut ? "opacity-30 blur-[0.5px] scale-98" : "opacity-100"} w-48 sm:w-56`}
          id={`org_node_${node.id}`}
        >
          {/* Online/Offline Dot */}
          <div className="absolute top-2 right-2 z-10 flex items-center justify-center">
            {node.status === "online" ? (
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 block border border-white animate-pulse" title="Đang hoạt động" />
            ) : (
              <span className="w-1.5 h-1.5 rounded-full bg-gray-300 block border border-white" title="Ngoại tuyến" />
            )}
          </div>

          <div className="space-y-2">


            {/* Middle row: Department (Main Title) */}
            <div className="min-h-[32px] flex items-center flex-wrap gap-1.5">
              <h4 className="font-bold text-xs text-slate-800 leading-snug font-sans line-clamp-2">
                {node.department}
              </h4>
              {node.isLeader && (
                <span className="bg-amber-500 text-white text-[8px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider font-mono shadow-sm flex items-center gap-0.5 shrink-0">
                  👑 Leader
                </span>
              )}
            </div>

            {/* Bottom row: Manager Info */}
            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              {renderAvatar(node.avatar, "w-6 h-6", "text-xs")}
              <div className="min-w-0 flex-1">
                <span className="block text-[8px] font-bold text-gray-400 uppercase tracking-wider truncate font-mono">
                  {renderCardIcon(node.role)} {node.role}
                </span>
                <span className="block text-[10px] font-bold text-indigo-950 truncate">
                  {node.name}
                </span>
              </div>
            </div>
          </div>

          {/* Collapse/Expand toggle badge */}
          {directReportsCount > 0 && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); toggleCollapse(node.id); }}
              title={isCollapsed ? `Mở rộng ${directReportsCount} thành viên cấp dưới` : `Thu gọn ${directReportsCount} thành viên cấp dưới`}
              className={`absolute -bottom-2.5 left-1/2 -translate-x-1/2 text-white text-[9px] font-extrabold w-5 h-5 rounded-full flex items-center justify-center shadow-xs border-2 border-white select-none transition-all cursor-pointer ${isCollapsed ? "bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white" : "bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white"
                }`}
            >
              {isCollapsed ? `+${directReportsCount}` : "^"}
            </button>
          )}
        </div>

        {/* Children Render recursive block */}
        {children.length > 0 && !isCollapsed && (
          <>
            <div className="w-0.5 h-6 bg-slate-300" />
            <div className="flex relative items-start">
              {children.map((child, index) => {
                const isFirst = index === 0;
                const isLast = index === children.length - 1;
                const hasSiblings = children.length > 1;

                return (
                  <div key={child.id} className="flex flex-col items-center px-4 relative">
                    {/* Horizontal Connector bar */}
                    {hasSiblings && (
                      <div className="absolute top-0 left-0 right-0 h-0.5 flex">
                        <div className={`w-1/2 ${isFirst ? '' : 'border-t-2 border-slate-300'}`} />
                        <div className={`w-1/2 ${isLast ? '' : 'border-t-2 border-slate-300'}`} />
                      </div>
                    )}
                    <div className="w-0.5 h-6 border-l-2 border-slate-300" />

                    {renderBranch(child)}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      {/* Division filter and search bar for Org Chart tab */}
      <div data-testid="org-chart-toolbar" className="flex shrink-0 flex-col gap-3 border-b border-gray-200 bg-slate-50 p-3 md:p-4 min-[1200px]:flex-row min-[1200px]:items-center min-[1200px]:justify-between">
        <div data-testid="org-chart-filters" className="grid w-full flex-1 grid-cols-1 items-stretch gap-2 min-[640px]:grid-cols-2 min-[1200px]:max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên hoặc chức danh..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 bg-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div data-testid="org-chart-department-filter" className="flex w-full items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-2.5 py-1.5">
            <Filter className="h-3.5 w-3.5 text-gray-400" />
            <select
              value={filterDepartment}
              onChange={(e) => setFilterDepartment(e.target.value)}
              className="bg-transparent text-xs outline-none cursor-pointer font-medium w-full"
            >
              <option value="Tất cả">Tất cả Phòng ban</option>
              {uniqueDepartments.map(dept => (
                <option key={dept} value={dept}>{dept}</option>
              ))}
            </select>
          </div>
        </div>

        <div data-testid="org-chart-actions" className="grid w-full grid-cols-1 items-center gap-2 min-[420px]:grid-cols-2 min-[768px]:grid-cols-3 min-[1200px]:flex min-[1200px]:w-auto">
          <div data-testid="org-chart-view-toggle" className="flex w-full items-center rounded-xl border border-gray-200 bg-white p-1 min-[1200px]:w-auto">
            <button type="button" onClick={() => setViewMode("tree")} className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer ${viewMode === "tree" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}><Network className="h-3.5 w-3.5" /> Cây</button>
            <button type="button" onClick={() => setViewMode("list")} className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-bold cursor-pointer ${viewMode === "list" ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}><List className="h-3.5 w-3.5" /> Danh sách</button>
          </div>

          <div data-testid="org-chart-zoom-control" className="flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-2 py-1.5 min-[1200px]:w-auto min-[1200px]:border-0 min-[1200px]:bg-transparent min-[1200px]:px-0">
            <div className="hidden h-6 w-px bg-gray-200 mx-1 min-[1200px]:block" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">Thu Phóng:</span>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.1"
              value={zoomLevel}
              onChange={(e) => {
                setZoomLevel(parseFloat(e.target.value));
                setIsFitted(false);
              }}
              className="w-20 accent-indigo-600 cursor-pointer"
            />
            <span className="w-10 text-right text-[10px] font-bold text-slate-655 mr-1">{Math.round(zoomLevel * 100)}%</span>
          </div>

          {isManager && (
            <>
              <div className="hidden h-6 w-px bg-gray-200 mx-1 min-[1200px]:block" />
              <button
                data-testid="org-chart-add-button"
                type="button"
                onClick={() => setIsAddModalOpen(true)}
                className="col-span-full flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-650 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-indigo-700 active:scale-95 cursor-pointer min-[768px]:col-span-1 min-[1200px]:w-auto"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Thêm thành viên</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Primary Sub Tab Layout View */}
      <div className="flex-1 p-3 md:p-6 overflow-y-auto" id="hr_tab_content">
        <div className="grid grid-cols-1 gap-6 h-full min-h-[500px]" id="org_chart_block">

          {viewMode === "list" && (
            <div className="col-span-1 bg-white border border-gray-200 rounded-2xl overflow-hidden min-h-[500px] flex flex-col justify-between">
              {isMobile ? (
                <div className="divide-y divide-slate-100 p-2">
                  {paginatedEmployees.map((employee) => {
                    const manager = getManagerForEmployee(employee, employees);
                    return (
                      <div
                        key={employee.id}
                        onClick={() => setSelectedEmp(employee)}
                        className="p-3 hover:bg-indigo-50/30 active:bg-indigo-50/60 cursor-pointer flex items-center justify-between gap-3 text-xs transition-all"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {renderAvatar(employee.avatar, "w-10 h-10 shrink-0", "text-sm")}
                          <div className="min-w-0">
                            <div className="font-bold text-slate-800 truncate">{employee.name || missingValue}</div>
                            <div className="text-[10px] text-slate-400 font-medium truncate mt-0.5">
                              {employee.role || missingValue} • {employee.department || missingValue}
                            </div>
                            {manager && (
                              <div className="text-[9px] text-slate-400 mt-0.5">
                                QL: <span className="font-semibold text-slate-655">{manager.name}</span>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] font-bold ${
                            employee.status === "online"
                              ? "bg-emerald-50 text-emerald-700 border border-emerald-250 animate-pulse"
                              : "bg-slate-50 text-slate-500 border border-slate-200"
                          }`}>
                            {employee.status === "online" ? "Online" : "Offline"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {visibleEmployees.length === 0 && (
                    <div className="py-16 text-center text-sm text-slate-400">Không tìm thấy thành viên</div>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[980px] text-left text-xs">
                    <thead className="bg-slate-50 border-b border-gray-200 text-[10px] uppercase tracking-wide text-slate-500">
                      <tr>
                        <th className="px-4 py-3">Thành viên</th>
                        <th className="px-4 py-3">Chức danh</th>
                        <th className="px-4 py-3">Phòng ban</th>
                        <th className="px-4 py-3">Khối</th>
                        <th className="px-4 py-3">Quản lý trực tiếp</th>
                        <th className="px-4 py-3">Liên hệ</th>
                        <th className="px-4 py-3">Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedEmployees.map((employee) => {
                        const manager = getManagerForEmployee(employee, employees);
                        return (
                          <tr
                            key={employee.id}
                            onClick={() => setSelectedEmp(employee)}
                            className="border-b border-slate-100 hover:bg-indigo-50/50 cursor-pointer"
                          >
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-2.5">
                                {renderAvatar(employee.avatar, "w-8 h-8", "text-xs")}
                                <div>
                                  <div className="font-bold text-slate-800">{employee.name || missingValue}</div>
                                  <div className="text-[10px] text-slate-400">{employee.id}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-4 py-3">{employee.role || missingValue}</td>
                            <td className="px-4 py-3">{employee.department || missingValue}</td>
                            <td className="px-4 py-3">{employee.division || missingValue}</td>
                            <td className="px-4 py-3">{manager?.name || missingValue}</td>
                            <td className="px-4 py-3">
                              {employee.email || missingValue}
                              <div className="text-[10px] text-slate-400">{employee.phone || missingValue}</div>
                            </td>
                            <td className="px-4 py-3">
                              <span
                                className={`inline-block px-2 py-0.5 rounded-full text-[9px] font-bold ${
                                  employee.status === "online"
                                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                                    : "bg-slate-50 text-slate-500 border border-slate-200"
                                }`}
                              >
                                {employee.status === "online" ? "Đang hoạt động" : "Ngoại tuyến"}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {visibleEmployees.length === 0 && (
                    <div className="py-16 text-center text-sm text-slate-400">Không tìm thấy thành viên</div>
                  )}
                </div>
              )}

              {/* Pagination Controls */}
              {visibleEmployees.length > listLimit && (
                <div className="flex items-center justify-between border-t border-slate-100 bg-white px-4 py-3 sm:px-6">
                  <div className="flex flex-1 justify-between sm:hidden">
                    <button
                      disabled={listPage === 1}
                      onClick={() => setListPage((p) => Math.max(p - 1, 1))}
                      className="relative inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Trước
                    </button>
                    <button
                      disabled={listPage * listLimit >= visibleEmployees.length}
                      onClick={() => setListPage((p) => p + 1)}
                      className="relative ml-3 inline-flex items-center rounded-md border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Sau
                    </button>
                  </div>
                  <div className="hidden sm:flex sm:flex-1 sm:items-center sm:justify-between">
                    <div>
                      <p className="text-xs text-slate-700">
                        Hiển thị từ <span className="font-medium">{(listPage - 1) * listLimit + 1}</span> đến{" "}
                        <span className="font-medium">{Math.min(listPage * listLimit, visibleEmployees.length)}</span> trong tổng số{" "}
                        <span className="font-medium">{visibleEmployees.length}</span> thành viên
                      </p>
                    </div>
                    <div>
                      <nav className="isolate inline-flex -space-x-px rounded-md shadow-sm" aria-label="Pagination">
                        <button
                          disabled={listPage === 1}
                          onClick={() => setListPage(1)}
                          className="relative inline-flex items-center rounded-l-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                        >
                          «
                        </button>
                        <button
                          disabled={listPage === 1}
                          onClick={() => setListPage((p) => Math.max(p - 1, 1))}
                          className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                        >
                          ‹
                        </button>
                        {Array.from({ length: Math.ceil(visibleEmployees.length / listLimit) }).map((_, idx) => {
                          const pageNum = idx + 1;
                          if (Math.abs(listPage - pageNum) > 2) return null;
                          return (
                            <button
                              key={pageNum}
                              onClick={() => setListPage(pageNum)}
                              className={`relative inline-flex items-center px-4 py-2 text-xs font-semibold focus:z-20 ${
                                listPage === pageNum
                                  ? "z-10 bg-indigo-650 text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-650"
                                  : "text-slate-900 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:outline-offset-0"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}
                        <button
                          disabled={listPage * listLimit >= visibleEmployees.length}
                          onClick={() => setListPage((p) => p + 1)}
                          className="relative inline-flex items-center px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                        >
                          ›
                        </button>
                        <button
                          disabled={listPage * listLimit >= visibleEmployees.length}
                          onClick={() => setListPage(Math.ceil(visibleEmployees.length / listLimit))}
                          className="relative inline-flex items-center rounded-r-md px-2 py-2 text-slate-400 ring-1 ring-inset ring-slate-300 hover:bg-slate-50 focus:z-20 focus:outline-offset-0 disabled:opacity-30 text-xs font-semibold"
                        >
                          »
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Interactive Tree viewport diagram - full width */}
          <div className={`col-span-1 bg-slate-50 border border-gray-250 rounded-2xl relative overflow-hidden flex flex-col min-h-[500px] ${viewMode === "tree" ? "" : "hidden"}`} id="tree_viewport">


            {/* Nút icon Vừa khung hình / Mở rộng đặt góc trên bên phải trong khung sơ đồ */}
            <button
              type="button"
              onClick={toggleFitScreen}
              className="absolute top-4 right-4 z-20 flex h-8 w-8 items-center justify-center rounded-xl bg-white/90 border border-gray-200 text-slate-700 shadow-2xs hover:bg-white hover:text-indigo-655 active:scale-95 transition-all cursor-pointer"
              title={isFitted ? "Phóng to (Mặc định)" : "Vừa khung hình"}
            >
              {isFitted ? <Maximize2 className="h-4 w-4" /> : <Minimize2 className="h-4 w-4" />}
            </button>
            <div
              ref={containerRef}
              onMouseDown={isMobile ? undefined : handleMouseDown}
              onMouseLeave={isMobile ? undefined : handleMouseLeaveOrUp}
              onMouseUp={isMobile ? undefined : handleMouseLeaveOrUp}
              onMouseMove={isMobile ? undefined : handleMouseMove}
              className={`flex-1 overflow-auto flex items-start justify-start min-h-[440px] select-none overscroll-none p-4 sm:p-12 ${
                isMobile ? "" : "cursor-grab"
              } ${isDragging && !isMobile ? "cursor-grabbing" : ""}`}
              id="interactive_org_chart"
            >
              <div
                style={
                  isSafari
                    ? {
                      transform: `scale(${zoomLevel})`,
                      transformOrigin: "top center",
                      transition: "transform 0.2s ease-out",
                    }
                    : {
                      zoom: zoomLevel,
                      transition: "zoom 0.2s ease-out",
                    }
                }
                className="flex flex-col items-center mx-auto min-w-max"
              >
                {employees.length === 0 ? (
                  <div className="text-center py-20 text-gray-400">
                    <Users className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-sm font-bold">Chưa có cơ cấu thành viên</p>
                    <p className="text-xs mt-1">Vui lòng thêm thành viên mới đầu tiên</p>
                  </div>
                ) : (
                  rootEmployees.map(root => renderBranch(root))
                )}
              </div>
            </div>

            {/* Chart footer notification guide */}

          </div>
        </div>
      </div>

      {/* EMPLOYEE DETAIL & EDIT MODAL */}
      {isDetailModalOpen && selectedEmp && (() => {
        const rawUser = usersList.find(u => u.uid === selectedEmp.id);
        const memberAvatar = rawUser?.photoURL || selectedEmp.avatar;
        const memberCover = rawUser?.coverImage || selectedEmp.coverImage;
        const memberName = rawUser?.displayName || selectedEmp.name;
        const memberRole = rawUser?.jobTitle || selectedEmp.role;
        const memberCompany = rawUser?.companyName || selectedEmp.companyName || "Chưa cập nhật";
        const memberIndustry = rawUser?.industry || selectedEmp.industry || "Chưa cập nhật";
        const memberDept = rawUser?.department || selectedEmp.department || "Ban Thành viên";
        const memberPhone = (rawUser?.phone && rawUser.phone !== "Chưa cập nhật") ? rawUser.phone : (selectedEmp.phone && selectedEmp.phone !== "Chưa cập nhật" ? selectedEmp.phone : "Chưa cập nhật");
        const memberEmail = rawUser?.email || selectedEmp.email || "Chưa cập nhật";
        const memberBirthDate = rawUser?.birthDate || selectedEmp.birthDate;

        return (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200" id="employee_detail_modal">
            {isEditing ? (
              <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 relative text-left space-y-4 animate-in fade-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <h4 className="font-bold text-slate-800 text-sm font-sans uppercase">Chỉnh Sửa Thành Viên</h4>
                  <button type="button" onClick={() => setIsEditing(false)} className="text-gray-400 hover:text-gray-600 cursor-pointer">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="space-y-3.5 text-xs text-left">
                  {/* Avatar Upload / Preview */}
                  <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-2xl border border-slate-150">
                    <div className="relative shrink-0">
                      {renderAvatar(editPhotoURL || selectedEmp.avatar, "w-16 h-16", "text-2xl", editName || selectedEmp.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <label className="block font-bold text-slate-700 mb-1">Ảnh đại diện</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="file"
                          ref={avatarFileInputRef}
                          accept="image/*"
                          className="hidden"
                          onChange={handleAvatarFileChange}
                        />
                        <button
                          type="button"
                          onClick={() => avatarFileInputRef.current?.click()}
                          disabled={uploadingAvatar}
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl text-slate-700 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {uploadingAvatar ? (
                            <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Upload className="w-3.5 h-3.5" />
                          )}
                          {uploadingAvatar ? "Đang tải ảnh..." : "Tải ảnh từ máy"}
                        </button>
                      </div>
                      <input
                        type="url"
                        placeholder="Hoặc dán URL ảnh trực tiếp"
                        value={editPhotoURL}
                        onChange={(e) => setEditPhotoURL(e.target.value)}
                        className="mt-2 w-full px-3 py-1.5 border border-gray-200 rounded-lg outline-none bg-white text-[11px]"
                      />
                    </div>
                  </div>

                  {/* Member Name */}
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Họ tên *</label>
                    <input
                      type="text"
                      required
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-700 bg-white font-medium"
                    />
                  </div>

                  {/* Company & Industry */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Công ty / Doanh nghiệp</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Công ty TNHH Giải Pháp Số"
                        value={editCompanyName}
                        onChange={(e) => setEditCompanyName(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-700 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Lĩnh vực hoạt động</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Phần mềm & Chuyển đổi số"
                        value={editIndustry}
                        onChange={(e) => setEditIndustry(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-700 bg-white"
                      />
                    </div>
                  </div>

                  {/* Role & Department */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Chức vụ trong Chapter</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Thành viên, Phó Chủ tịch"
                        value={editRoleText}
                        onChange={(e) => setEditRoleText(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-700 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Ban / Nhóm</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Ban Khách Mời, Ban Sự Kiện"
                        value={editDepartment}
                        onChange={(e) => setEditDepartment(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-700 bg-white"
                      />
                    </div>
                  </div>

                  {/* Phone & BirthDate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Số điện thoại</label>
                      <input
                        type="text"
                        placeholder="090XXXXXXXX"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-700 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Ngày sinh</label>
                      <input
                        type="date"
                        value={editBirthDate}
                        onChange={(e) => setEditBirthDate(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-700 bg-white"
                      />
                    </div>
                  </div>

                  {/* Email (fixed) */}
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Email liên lạc (Cố định)</label>
                    <input
                      type="email"
                      value={editEmail}
                      disabled
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none bg-gray-100 text-gray-400 cursor-not-allowed select-none"
                    />
                  </div>

                  {/* Direct Manager / Connector */}
                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Người kết nối / Báo cáo cho</label>
                    <select
                      value={editParentId}
                      onChange={(e) => setEditParentId(e.target.value)}
                      className="w-full p-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-red-500 bg-white cursor-pointer text-slate-700"
                    >
                      <option value="">Không phân công (Gốc sơ đồ)</option>
                      {employees
                        .filter(emp => emp.id !== selectedEmp.id)
                        .map(emp => (
                          <option key={emp.id} value={emp.id}>{emp.name} ({emp.role}{emp.companyName ? ` · ${emp.companyName}` : ""})</option>
                        ))
                      }
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 text-xs font-bold">
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={() => setIsEditing(false)}
                    className="px-4 py-2 border rounded-xl hover:bg-slate-50 cursor-pointer disabled:opacity-50"
                  >
                    Hủy bỏ
                  </button>
                  <button
                    type="button"
                    disabled={isSaving}
                    onClick={handleEditEmployeeSave}
                    className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
                  >
                    {isSaving ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Đang lưu...
                      </>
                    ) : (
                      "Lưu thay đổi"
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="bg-white border border-slate-100 rounded-3xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto relative text-left animate-in fade-in zoom-in-95 duration-200">
                {/* Header Cover Banner */}
                <div className="relative h-28 w-full overflow-hidden rounded-t-3xl bg-gradient-to-r from-red-600 via-rose-600 to-amber-600">
                  {memberCover && (
                    <img src={memberCover} alt="Cover" className="w-full h-full object-cover opacity-90" />
                  )}
                  <button
                    type="button"
                    onClick={closeDetailModal}
                    className="absolute top-3 right-3 h-8 w-8 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center transition-all cursor-pointer backdrop-blur-xs z-10"
                    title="Đóng"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                {/* Avatar & Profile Identity */}
                <div className="px-6 pb-6 pt-0">
                  <div className="flex flex-col items-center -mt-12 text-center pb-4 border-b border-slate-100">
                    <div className="relative">
                      {renderAvatar(memberAvatar, "w-24 h-24", "text-3xl", memberName)}
                      <span
                        className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white ${
                          selectedEmp.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                        }`}
                        title={selectedEmp.status === "online" ? "Đang hoạt động" : "Ngoại tuyến"}
                      />
                    </div>
                    <h3 className="font-extrabold text-xl text-slate-900 mt-2.5 font-sans leading-tight">
                      {memberName}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-1.5">
                      <span className="text-xs font-bold text-red-600 bg-red-50 border border-red-200 px-3 py-0.5 rounded-full">
                        {memberRole}
                      </span>
                      {selectedEmp.isLeader && (
                        <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                          👑 Trưởng ban
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Information Grid */}
                  <div className="mt-4 space-y-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-150 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="flex items-start gap-2.5">
                        <Building2 className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Doanh nghiệp</span>
                          <strong className="text-slate-800 text-xs font-bold block truncate">{memberCompany}</strong>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Briefcase className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Lĩnh vực hoạt động</span>
                          <strong className="text-slate-800 text-xs font-bold block truncate">{memberIndustry}</strong>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Users className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ban / Nhóm</span>
                          <strong className="text-slate-800 text-xs font-bold block truncate">{memberDept}</strong>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <CalendarDays className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Ngày sinh</span>
                          <strong className="text-slate-800 text-xs font-bold block truncate">
                            {memberBirthDate ? new Date(memberBirthDate).toLocaleDateString("vi-VN") : "Chưa cập nhật"}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Phone className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Số điện thoại</span>
                          <a href={`tel:${memberPhone}`} className="text-slate-800 hover:text-red-600 text-xs font-bold block truncate">
                            {memberPhone}
                          </a>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Mail className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email liên hệ</span>
                          <a href={`mailto:${memberEmail}`} className="text-slate-800 hover:text-red-600 text-xs font-bold block truncate">
                            {memberEmail}
                          </a>
                        </div>
                      </div>
                    </div>

                    {/* Direct Manager / Connector */}
                    {selectedEmp.parentId && (() => {
                      const manager = employees.find(e => e.id === selectedEmp.parentId);
                      return (
                        <div className="p-3 rounded-2xl bg-indigo-50/50 border border-indigo-100 flex items-center gap-3">
                          <Users className="w-4.5 h-4.5 text-indigo-600 shrink-0" />
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] font-bold text-indigo-500 uppercase tracking-wider">Người kết nối / Quản lý</span>
                            <strong className="text-slate-800 text-xs font-bold truncate block">
                              {manager ? `${manager.name} (${manager.role})` : "Quản lý cấp trên"}
                            </strong>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Subordinates */}
                    {(() => {
                      const directSubs = getDirectSubordinates(selectedEmp.id);
                      if (directSubs.length > 0) {
                        return (
                          <div className="pt-2">
                            <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                              Thành viên nhánh kết nối ({directSubs.length})
                            </span>
                            <div className="flex flex-col gap-2 max-h-[160px] overflow-y-auto pr-1">
                              {directSubs.map((sub) => (
                                <button
                                  type="button"
                                  key={sub.id}
                                  onClick={() => setSelectedEmp(sub)}
                                  className="flex items-center gap-3 bg-slate-50 hover:bg-red-50/60 border border-slate-150 hover:border-red-200 px-3 py-2 rounded-xl transition-all text-left cursor-pointer"
                                >
                                  {renderAvatar(sub.avatar, "w-8 h-8", "text-xs", sub.name)}
                                  <div className="min-w-0 flex-1">
                                    <span className="block text-xs font-bold text-slate-800 truncate">{sub.name}</span>
                                    <span className="block text-[10px] text-slate-500 truncate">{sub.companyName || sub.role}</span>
                                  </div>
                                </button>
                              ))}
                            </div>
                          </div>
                        );
                      }
                      return null;
                    })()}
                  </div>

                  {/* Modal Actions */}
                  <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap gap-2.5">
                    {canEditEmployee(selectedEmp.id) && (
                      <button
                        type="button"
                        onClick={startEditing}
                        className="flex-1 py-2.5 px-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Chỉnh sửa thông tin
                      </button>
                    )}

                    {isManager && usersList.find(u => u.uid === selectedEmp.id)?.role === "user" && (
                      <button
                        type="button"
                        onClick={handleToggleLeader}
                        disabled={isSavingLeader}
                        className={`py-2.5 px-3.5 border rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer active:scale-95 disabled:opacity-50 ${
                          selectedEmp.isLeader
                            ? "bg-amber-50 hover:bg-amber-100 border-amber-200 text-amber-800"
                            : "bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-700"
                        }`}
                      >
                        {isSavingLeader ? (
                          <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                        ) : selectedEmp.isLeader ? (
                          "Hủy Trưởng ban"
                        ) : (
                          "👑 Đặt làm Trưởng ban"
                        )}
                      </button>
                    )}

                    {canDeleteEmployee(selectedEmp.id) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteEmployeeSubmit(selectedEmp.id)}
                        className="py-2.5 px-3.5 border border-red-200 bg-red-50 hover:bg-red-100 text-red-700 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5"
                        title="Xóa thành viên này khỏi sơ đồ"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        Xóa
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ADD MEMBER MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <form onSubmit={handleAddEmployee} className="bg-white border rounded-3xl shadow-2xl w-full max-w-lg max-h-[calc(100dvh-2rem)] overflow-y-auto p-6 relative text-left space-y-4">
            <div className="flex justify-between items-center pb-2 border-b border-slate-100">
              <h4 className="font-bold text-slate-800 text-sm font-sans uppercase">Thêm Thành Viên Mới</h4>
              <button type="button" onClick={() => setIsAddModalOpen(false)} className="text-gray-400 hover:text-gray-650 cursor-pointer">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-gray-500 mb-1">Họ tên thành viên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 font-medium text-slate-800"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Công ty / Doanh nghiệp *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Công ty TNHH ABC"
                    value={addCompanyName}
                    onChange={(e) => setAddCompanyName(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Lĩnh vực hoạt động *</label>
                  <input
                    type="text"
                    required
                    placeholder="Ví dụ: Bất động sản, Thiết kế nội thất"
                    value={addIndustry}
                    onChange={(e) => setAddIndustry(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Email đăng nhập *</label>
                  <input
                    type="email"
                    required
                    placeholder="nguyenvana@gmail.com"
                    value={addEmail}
                    onChange={(e) => setAddEmail(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Số điện thoại *</label>
                  <input
                    type="text"
                    required
                    placeholder="090XXXXXXXX"
                    value={addPhone}
                    onChange={(e) => setAddPhone(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Mật khẩu khởi tạo *</label>
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Ban / Nhóm hoạt động</label>
                  <input
                    type="text"
                    placeholder="Ví dụ: Ban Thành viên, Ban Khách Mời"
                    value={addDepartment}
                    onChange={(e) => setAddDepartment(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Vai trò hệ thống</label>
                  <select
                    value={addRole}
                    onChange={(e) => setAddRole(e.target.value as any)}
                    className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 bg-white cursor-pointer text-slate-800"
                  >
                    <option value="user">Thành viên (Member)</option>
                    <option value="manager">Ban điều hành (LT / Manager)</option>
                    <option value="branch_owner">Chủ tịch Chapter</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-gray-500 mb-1">Người kết nối / Phụ trách</label>
                  <select
                    value={addParentId}
                    onChange={(e) => setAddParentId(e.target.value)}
                    className="w-full p-2 border rounded-xl outline-none focus:ring-2 focus:ring-red-500 bg-white cursor-pointer text-slate-800"
                  >
                    <option value="">Không phân công</option>
                    {employees.map(emp => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role}{emp.companyName ? ` · ${emp.companyName}` : ""})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end gap-3 text-xs font-bold">
              <button
                type="button"
                disabled={isAddingEmployee}
                onClick={() => setIsAddModalOpen(false)}
                className="px-4 py-2 border rounded-xl hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                disabled={isAddingEmployee}
                className="px-5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
              >
                {isAddingEmployee ? (
                  <>
                    <RefreshCw className="animate-spin h-3.5 w-3.5" />
                    Đang thêm...
                  </>
                ) : (
                  "Lưu thành viên"
                )}
              </button>
            </div>
          </form>
        </div>
      )}


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

    </>
  );
}
