import MemberMessageButton from "./MemberMessageButton";
import React, { useState, useRef } from "react";
import {
  Users,
  Search,
  Plus,
  Building2,
  Trash2,
  X,
  RefreshCw,
  Briefcase,
  Phone,
  Mail,
  Edit,
  Upload,
  CalendarDays,
  Camera,
  Image as ImageIcon,
  UserRound,
  Target,
  MapPin,
} from "lucide-react";
import { EmployeeNode, UserProfile, TrainingCourse } from "../../types";
import { authService, getAccessToken } from "../../services/authService";
import { toast } from "../../pages/Toast";
import { ConfirmDialog } from "../common/ConfirmDialog";
import { VietnameseDatePicker } from "../common/VietnameseDatePicker";
import { getApiErrorMessage } from "../../utils/errorMessage";
import { filterOrgChartEmployees, getManagerForEmployee } from "./orgChartUtils";

interface OrgChartTabProps {
  userProfile: import("../../types").UserProfile;
  selectedCompanyCode: string;
  usersList: UserProfile[];
  employees: EmployeeNode[];
  fetchUsers: () => Promise<void>;
  isManager: boolean;
  companies: import("../../types").CompanyProfile[];
  courses: TrainingCourse[];
  fetchCourses: (compCode: string) => Promise<void>;
  loading: boolean;
  activeBranchId?: string;
}

const isUrl = (str?: string): boolean => {
  if (!str) return false;
  return str.startsWith("http://") || str.startsWith("https://") || str.startsWith("data:image/") || str.startsWith("/");
};

type MemberGalleryImage = { url: string; uploadToken?: string };
const MAX_MEMBER_GALLERY_IMAGES = 5;
const EMAIL_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

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
              parent.classList.add("bg-gradient-to-tr", "from-blue-600", "to-indigo-500", "text-white", "font-bold");
              parent.innerText = nameFallback ? nameFallback.trim().charAt(0).toUpperCase() : "👤";
            }
          }}
        />
      </div>
    );
  }
  return (
    <div className={`${sizeClasses} bg-gradient-to-tr from-blue-600 to-indigo-500 text-white font-bold rounded-full shrink-0 flex items-center justify-center border-2 border-white shadow-xs select-none`}>
      <span className={textClass}>{nameFallback ? nameFallback.trim().charAt(0).toUpperCase() : (avatar || "👤")}</span>
    </div>
  );
};


export default function OrgChartTab({
  userProfile,
  selectedCompanyCode,
  usersList,
  employees,
  fetchUsers,
  isManager,
  companies: _companies,
  courses,
  fetchCourses,
  loading,
  activeBranchId,
}: OrgChartTabProps) {
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
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [selectedEmp, setSelectedEmp] = useState<EmployeeNode | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);

  const [listPage, setListPage] = useState<number>(1);
  const listLimit = 15;

  const [previousInputs11, setPreviousInputs11] = useState<unknown[] | null>(null);
  if (previousInputs11 === null || !Object.is(previousInputs11[0], searchQuery)) {
    setPreviousInputs11([searchQuery]);
    setListPage(1);

  }

  const [previousInputs1, setPreviousInputs1] = useState<unknown[] | null>(null);
  if (previousInputs1 === null || !Object.is(previousInputs1[0], selectedEmp?.id)) {
    setPreviousInputs1([selectedEmp?.id]);
    if (selectedEmp) {
      setIsDetailModalOpen(true);
    } else {
      setIsDetailModalOpen(false);
    }

  }

  const closeDetailModal = () => {
    setIsDetailModalOpen(false);
    setSelectedEmp(null);
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
  const [addBirthDate, setAddBirthDate] = useState("");
  const [addGender, setAddGender] = useState<"" | "male" | "female" | "other">("");
  const [addAddress, setAddAddress] = useState("");
  const [addTargetMarket, setAddTargetMarket] = useState("");
  const [addParentId, setAddParentId] = useState("");
  const [addRole, setAddRole] = useState<"user" | "manager" | "branch_owner" | "admin">("user");
  const [addPhotoURL, setAddPhotoURL] = useState("");
  const [addCoverImage, setAddCoverImage] = useState("");
  const [addGalleryImages, setAddGalleryImages] = useState<MemberGalleryImage[]>([]);
  const [uploadingAddAvatar, setUploadingAddAvatar] = useState(false);
  const [uploadingAddCover, setUploadingAddCover] = useState(false);
  const [uploadingAddGallery, setUploadingAddGallery] = useState(false);
  const addAvatarFileInputRef = useRef<HTMLInputElement>(null);
  const addCoverFileInputRef = useRef<HTMLInputElement>(null);
  const addGalleryInputRef = useRef<HTMLInputElement>(null);

  // Edit Member States
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editCompanyName, setEditCompanyName] = useState("");
  const [editIndustry, setEditIndustry] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editBirthDate, setEditBirthDate] = useState("");
  const [editGender, setEditGender] = useState<"" | "male" | "female" | "other">("");
  const [editAddress, setEditAddress] = useState("");
  const [editTargetMarket, setEditTargetMarket] = useState("");
  const [editPhotoURL, setEditPhotoURL] = useState("");
  const [editCoverImage, setEditCoverImage] = useState("");
  const [editGalleryImages, setEditGalleryImages] = useState<MemberGalleryImage[]>([]);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingEditCover, setUploadingEditCover] = useState(false);
  const [uploadingEditGallery, setUploadingEditGallery] = useState(false);
  const avatarFileInputRef = useRef<HTMLInputElement>(null);
  const editCoverFileInputRef = useRef<HTMLInputElement>(null);
  const editGalleryInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Reset editing state when selected employee changes
  const [previousInputs2, setPreviousInputs2] = useState<unknown[] | null>(null);
  if (previousInputs2 === null || !Object.is(previousInputs2[0], selectedEmp?.id)) {
    setPreviousInputs2([selectedEmp?.id]);
    setIsEditing(false);

  }

  const startEditing = () => {
    if (!selectedEmp) return;
    const raw = usersList.find(u => u.uid === selectedEmp.id);
    setEditName(raw?.displayName || selectedEmp.name || "");
    setEditCompanyName(raw?.companyName || selectedEmp.companyName || "");
    setEditIndustry(raw?.industry || selectedEmp.industry || "");
    setEditGender(raw?.gender || selectedEmp.gender || "");
    setEditAddress(raw?.address || selectedEmp.address || "");
    setEditTargetMarket(raw?.targetMarket || selectedEmp.targetMarket || "");
    setEditEmail(raw?.email || selectedEmp.email || "");
    setEditPhone(raw?.phone && raw.phone !== "Chưa cập nhật" ? raw.phone : (selectedEmp.phone && selectedEmp.phone !== "Chưa cập nhật" ? selectedEmp.phone : ""));
    setEditPhotoURL(raw?.photoURL || selectedEmp.avatar || "");
    setEditCoverImage(raw?.coverImage || selectedEmp.coverImage || "");
    setEditGalleryImages((raw?.galleryImages || selectedEmp.galleryImages || []).slice(0, MAX_MEMBER_GALLERY_IMAGES).map(url => ({ url })));
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
      const compCode = selectedCompanyCode || userProfile?.companyCode;
      const res = await authService.uploadManagedFile(
        file,
        "profile.avatar",
        compCode === "SYSTEM" ? undefined : compCode
      );
      setEditPhotoURL(res.url);
      toast.success("Đã tải lên ảnh đại diện.");
    } catch (err) {
      toast.error(err?.message || "Không thể tải lên ảnh đại diện.");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleEditCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingEditCover(true);
    try {
      const compCode = selectedCompanyCode || userProfile?.companyCode;
      const res = await authService.uploadManagedFile(
        file,
        "profile.cover",
        compCode === "SYSTEM" ? undefined : compCode
      );
      setEditCoverImage(res.url);
      toast.success("Đã tải lên ảnh bìa thành công.");
    } catch (err) {
      toast.error(err?.message || "Không thể tải lên ảnh bìa.");
    } finally {
      setUploadingEditCover(false);
    }
  };

  const uploadMemberGalleryFiles = async (
    files: File[],
    currentImages: MemberGalleryImage[],
    setImages: React.Dispatch<React.SetStateAction<MemberGalleryImage[]>>,
    setUploading: (uploading: boolean) => void,
  ) => {
    const remaining = MAX_MEMBER_GALLERY_IMAGES - currentImages.length;
    if (remaining <= 0) {
      toast.warning("Album chỉ chứa tối đa 5 ảnh.");
      return;
    }
    if (files.length > remaining) {
      toast.info(`Chỉ có thể thêm ${remaining} ảnh nữa.`);
    }

    setUploading(true);
    const uploaded: MemberGalleryImage[] = [];
    try {
      const compCode = selectedCompanyCode || userProfile?.companyCode;
      for (const file of files.slice(0, remaining)) {
        try {
          const result = await authService.uploadManagedFile(
            file,
            "profile.gallery",
            compCode === "SYSTEM" ? undefined : compCode,
          );
          uploaded.push({ url: result.url, uploadToken: result.uploadToken });
        } catch (err: unknown) {
          toast.error(getApiErrorMessage(err, `Không thể tải ảnh ${file.name}.`));
          break;
        }
      }
      if (uploaded.length > 0) setImages(previous => [...previous, ...uploaded].slice(0, MAX_MEMBER_GALLERY_IMAGES));
    } finally {
      setUploading(false);
    }
  };

  const handleAddGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length) void uploadMemberGalleryFiles(files, addGalleryImages, setAddGalleryImages, setUploadingAddGallery);
  };

  const handleEditGalleryFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length) void uploadMemberGalleryFiles(files, editGalleryImages, setEditGalleryImages, setUploadingEditGallery);
  };

  const handleAddAvatarFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAddAvatar(true);
    try {
      const compCode = selectedCompanyCode || userProfile?.companyCode;
      const res = await authService.uploadManagedFile(
        file,
        "profile.avatar",
        compCode === "SYSTEM" ? undefined : compCode
      );
      setAddPhotoURL(res.url);
      toast.success("Đã tải lên ảnh đại diện.");
    } catch (err) {
      toast.error(err?.message || "Không thể tải lên ảnh đại diện.");
    } finally {
      setUploadingAddAvatar(false);
    }
  };

  const handleAddCoverFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setUploadingAddCover(true);
    try {
      const compCode = selectedCompanyCode || userProfile?.companyCode;
      const res = await authService.uploadManagedFile(
        file,
        "profile.cover",
        compCode === "SYSTEM" ? undefined : compCode
      );
      setAddCoverImage(res.url);
      toast.success("Đã tải lên ảnh bìa thành công.");
    } catch (err) {
      toast.error(err?.message || "Không thể tải lên ảnh bìa.");
    } finally {
      setUploadingAddCover(false);
    }
  };

  const handleEditEmployeeSave = async () => {
    if (!selectedEmp) return;

    if (!editName.trim()) {
      toast.warning("Vui lòng nhập đầy đủ Họ tên!");
      return;
    }

    const normalizedEmail = editEmail.trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
      toast.warning("Địa chỉ email không đúng định dạng!");
      return;
    }

    const duplicateEmail = usersList.find(
      user => user.uid !== selectedEmp.id && user.email?.trim().toLowerCase() === normalizedEmail,
    );
    if (duplicateEmail) {
      toast.error(`Email "${normalizedEmail}" đã được sử dụng bởi thành viên khác!`);
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
      const updateData = {
        displayName: editName.trim(),
        email: normalizedEmail,
        companyName: editCompanyName.trim(),
        industry: editIndustry.trim(),
        phone: editPhone.trim() || "",
        photoURL: editPhotoURL.trim() || "",
        coverImage: editCoverImage.trim() || "",
        galleryImages: editGalleryImages.map(image => image.url),
        galleryUploadTokens: editGalleryImages.flatMap((image, index) => image.uploadToken ? [{ index, uploadToken: image.uploadToken }] : []),
        birthDate: editBirthDate || undefined,
        gender: editGender || undefined,
        address: editAddress.trim(),
        targetMarket: editTargetMarket.trim(),
      };

      await authService.updateUser(selectedEmp.id, updateData);
      toast.success("Cập nhật thông tin thành viên thành công!");
      setIsEditing(false);
      await fetchUsers();

      // Cập nhật selectedEmp cục bộ
      setSelectedEmp((prev) => prev ? {
        ...prev,
        name: updateData.displayName,
        email: updateData.email,
        role: selectedEmp.role,
        companyName: updateData.companyName,
        industry: updateData.industry,
        phone: updateData.phone || "Chưa cập nhật",
        avatar: updateData.photoURL || prev.avatar,
        coverImage: updateData.coverImage ?? prev.coverImage,
        galleryImages: updateData.galleryImages,
        birthDate: updateData.birthDate,
        gender: updateData.gender,
        address: updateData.address,
        targetMarket: updateData.targetMarket,
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


  // Set default parentId when add employee modal is opened
  const [previousInputs3, setPreviousInputs3] = useState<unknown[] | null>(null);
  if (previousInputs3 === null || !Object.is(previousInputs3[0], isAddModalOpen) || !Object.is(previousInputs3[1], userProfile) || !Object.is(previousInputs3[2], selectedCompanyCode) || !Object.is(previousInputs3[3], usersList)) {
    setPreviousInputs3([isAddModalOpen, userProfile, selectedCompanyCode, usersList]);
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
        setAddParentId(firstCompanyManager?.uid || firstBranchOwner?.uid || "");
      }
    }

  }

  // Handle parentId based on addRole automatically
  const [previousInputs4, setPreviousInputs4] = useState<unknown[] | null>(null);
  if (previousInputs4 === null || !Object.is(previousInputs4[0], addRole) || !Object.is(previousInputs4[1], isAddModalOpen) || !Object.is(previousInputs4[2], selectedCompanyCode) || !Object.is(previousInputs4[3], userProfile) || !Object.is(previousInputs4[4], usersList)) {
    setPreviousInputs4([addRole, isAddModalOpen, selectedCompanyCode, userProfile, usersList]);
    if (isAddModalOpen) {
      const compCode = selectedCompanyCode || userProfile?.companyCode || "SYSTEM";
      if (addRole === "admin") {
        setAddParentId("");
      } else if (addRole === "branch_owner") {
        setAddParentId("");
      } else if (addRole === "manager") {
        const branchOwner = usersList.find(
          (u) => u.companyCode === compCode && u.role === "branch_owner"
        );
        setAddParentId(branchOwner?.uid || "");
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
          setAddParentId(firstCompanyManager?.uid || branchOwner?.uid || "");
        }
      }
    }

  }



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
    if (!EMAIL_REGEX.test(addEmail.trim())) {
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



    const finalCompName = addCompanyName.trim() || compName;
    try {
      setIsAddingEmployee(true);
      const newUid = await authService.registerUserForCompany({
        displayName: addName.trim(),
        email: addEmail.trim(),
        password: addPassword,
        role: addRole,
        companyCode: compCode,
        companyName: finalCompName,
        parentId: addParentId || undefined,
        phone: addPhone.trim(),
        branchId: activeBranchId || undefined,
        birthDate: addBirthDate ? addBirthDate : undefined,
        gender: addGender || undefined,
        address: addAddress.trim(),
        targetMarket: addTargetMarket.trim(),
        ...{
          industry: addIndustry.trim() || undefined,
          photoURL: addPhotoURL.trim() || undefined,
          coverImage: addCoverImage.trim() || undefined,
          galleryImages: addGalleryImages.map(image => image.url),
          galleryUploadTokens: addGalleryImages.flatMap((image, index) => image.uploadToken ? [{ index, uploadToken: image.uploadToken }] : []),
        }
      });

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
      setAddBirthDate("");
      setAddGender("");
      setAddAddress("");
      setAddTargetMarket("");
      setAddPhotoURL("");
      setAddCoverImage("");
      setAddGalleryImages([]);
      setAddParentId("");
      setAddRole("user");

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

  const visibleEmployees = filterOrgChartEmployees(employees, searchQuery);
  const paginatedEmployees = visibleEmployees.slice((listPage - 1) * listLimit, listPage * listLimit);
  const missingValue = "Chưa cập nhật";

  return (
    <>
      {/* Search bar and actions for Org Chart tab */}
      <div data-testid="org-chart-toolbar" className="flex shrink-0 flex-col gap-3 border-b border-gray-200 bg-slate-50 p-3 md:p-4 min-[1200px]:flex-row min-[1200px]:items-center min-[1200px]:justify-between">
        <div data-testid="org-chart-filters" className="w-full flex-1 min-[1200px]:max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Tìm theo tên, doanh nghiệp hoặc ngành nghề..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-200 bg-white rounded-xl text-xs focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
        </div>

        <div data-testid="org-chart-actions" className="flex w-full items-center justify-end gap-2 min-[1200px]:w-auto">
          {isManager && (
            <button
              data-testid="org-chart-add-button"
              type="button"
              onClick={() => setIsAddModalOpen(true)}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white shadow-xs transition-all hover:bg-blue-700 active:scale-95 cursor-pointer min-[640px]:w-auto"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Thêm thành viên</span>
            </button>
          )}
        </div>
      </div>

      {/* Primary Sub Tab Layout View */}
      <div className="flex-1 p-3 md:p-6 overflow-y-auto" id="hr_tab_content">
        <div className="grid grid-cols-1 content-start gap-6" id="org_chart_block">

          <div className="col-span-1 flex min-w-0 flex-col gap-4">

            <div className="flex flex-wrap items-center justify-between gap-2 px-1">
              <h3 className="text-sm font-bold text-slate-800">Danh sách thành viên</h3>
              <p className="text-xs text-slate-500">{visibleEmployees.length} thành viên · Bấm vào thẻ để xem hồ sơ</p>
            </div>
            {loading ? (
              <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><RefreshCw className="h-4 w-4 animate-spin" />Đang tải thành viên...</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 min-[1200px]:grid-cols-5 xl:grid-cols-5 2xl:grid-cols-5">
                {paginatedEmployees.map((employee) => {
                  const manager = getManagerForEmployee(employee, employees);
                  return (
                    <button
                      key={employee.id}
                      type="button"
                      aria-label={"Xem hồ sơ " + employee.name}
                      onClick={() => setSelectedEmp(employee)}
                      className="group flex min-w-0 flex-col rounded-xl border border-slate-200 bg-white p-3.5 text-left shadow-xs transition hover:border-cyan-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-500 cursor-pointer"
                    >
                      {/* Top: Avatar + Name + Role + Status */}
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          {renderAvatar(employee.avatar, "w-11 h-11", "text-sm", employee.name)}
                          <span
                            className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white ${employee.status === "online" ? "bg-emerald-500" : "bg-slate-300"
                              }`}
                            title={employee.status === "online" ? "Đang hoạt động" : "Ngoại tuyến"}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1.5">
                            <span className="truncate text-sm font-bold text-slate-900 group-hover:text-cyan-700 transition-colors">
                              {employee.name || missingValue}
                            </span>
                            <span
                              className={
                                "shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-semibold " +
                                (employee.status === "online"
                                  ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                  : "bg-slate-100 text-slate-500")
                              }
                            >
                              {employee.status === "online" ? "Online" : "Offline"}
                            </span>
                          </div>
                          <p className="truncate text-xs font-medium text-cyan-700 mt-0.5">
                            {employee.role && employee.role.trim().toLowerCase() !== "nhân viên"
                              ? employee.role
                              : "Thành viên"}
                          </p>
                        </div>
                      </div>

                      {/* Middle: Compact metadata */}
                      <div className="mt-2.5 flex flex-1 flex-col gap-1.5 text-xs text-slate-600 border-t border-slate-100 pt-2">
                        {(() => {
                          const companyOrDept = employee.companyName;
                          if (!companyOrDept) return null;
                          return (
                            <div className="flex items-center gap-1.5 min-w-0 text-slate-600">
                              <Building2 className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                              <span className="truncate text-[11px]">{companyOrDept}</span>
                            </div>
                          );
                        })()}
                        {employee.email && (
                          <div className="flex items-center gap-1.5 min-w-0 text-slate-500">
                            <Mail className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate text-[11px]">{employee.email}</span>
                          </div>
                        )}
                        {employee.phone && employee.phone !== "Chưa cập nhật" && (
                          <div className="flex items-center gap-1.5 min-w-0 text-slate-500">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate text-[11px]">{employee.phone}</span>
                          </div>
                        )}
                        {manager && (
                          <div className="flex items-center gap-1.5 min-w-0 text-slate-500">
                            <Users className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                            <span className="truncate text-[11px]">Quản lý: {manager.name}</span>
                          </div>
                        )}
                      </div>
                    </button>
                  );
                })}
                {!visibleEmployees.length && <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-16 text-center text-sm text-slate-500">{employees.length ? "Không tìm thấy thành viên phù hợp." : "Chưa có thành viên."}</div>}
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
                            className={`relative inline-flex items-center px-4 py-2 text-xs font-semibold focus:z-20 ${listPage === pageNum
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
        </div>
      </div>

      {/* EMPLOYEE DETAIL & EDIT MODAL */}
      {isDetailModalOpen && selectedEmp && (() => {
        const rawUser = usersList.find(u => u.uid === selectedEmp.id);
        const memberAvatar = rawUser?.photoURL || selectedEmp.avatar;
        const memberCover = (rawUser ? rawUser.coverImage : selectedEmp.coverImage)?.trim();
        const memberName = rawUser?.displayName || selectedEmp.name;
        const memberRole = selectedEmp.role || "Thành viên";
        const memberCompany = rawUser?.companyName || selectedEmp.companyName || "Chưa cập nhật";
        const memberIndustry = rawUser?.industry || selectedEmp.industry || "Chưa cập nhật";
        const memberGender = rawUser?.gender || selectedEmp.gender;
        const memberAddress = rawUser?.address || selectedEmp.address || "Chưa cập nhật";
        const memberTargetMarket = rawUser?.targetMarket || selectedEmp.targetMarket || "Chưa cập nhật";
        const memberGalleryImages = (rawUser?.galleryImages || selectedEmp.galleryImages || []).slice(0, MAX_MEMBER_GALLERY_IMAGES);
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
                  {/* Visual Cover Image & Avatar Preview Section */}
                  <div className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xs">
                    {/* Cover Banner */}
                    <div className="relative h-28 sm:h-32 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 overflow-hidden">
                      {editCoverImage ? (
                        <img
                          key={editCoverImage}
                          src={editCoverImage}
                          alt="Ảnh bìa"
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-40 text-white">
                          <ImageIcon className="h-7 w-7" />
                          <span className="text-[10px] font-medium tracking-wide">Chưa có ảnh bìa</span>
                        </div>
                      )}
                      {/* Cover Image Action Buttons */}
                      <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                        <input
                          ref={editCoverFileInputRef}
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleEditCoverFileChange}
                        />
                        <button
                          type="button"
                          onClick={() => editCoverFileInputRef.current?.click()}
                          disabled={uploadingEditCover}
                          className="px-2.5 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                        >
                          {uploadingEditCover ? (
                            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Camera className="h-3.5 w-3.5" />
                          )}
                          <span>{uploadingEditCover ? "Đang tải..." : (editCoverImage ? "Đổi ảnh bìa" : "Tải ảnh bìa")}</span>
                        </button>
                        {editCoverImage && (
                          <button
                            type="button"
                            onClick={() => setEditCoverImage("")}
                            title="Xóa ảnh bìa"
                            className="p-1.5 bg-black/60 hover:bg-red-600 backdrop-blur-md text-white rounded-xl transition cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Avatar & Upload Bar */}
                    <div className="px-4 pb-3.5 pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                      <div className="flex items-center gap-3.5 -mt-10 sm:-mt-12">
                        <div className="relative group shrink-0">
                          <div className="h-18 w-18 sm:h-20 sm:w-20 rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center">
                            {renderAvatar(editPhotoURL || selectedEmp.avatar, "w-full h-full", "text-xl", editName || selectedEmp.name)}
                          </div>
                          <button
                            type="button"
                            onClick={() => avatarFileInputRef.current?.click()}
                            disabled={uploadingAvatar}
                            title="Tải ảnh đại diện"
                            className="absolute inset-0 bg-black/45 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                          >
                            {uploadingAvatar ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                          </button>
                        </div>
                        <div>
                          <span className="font-bold text-slate-800 text-sm block">{editName || selectedEmp.name}</span>
                          <span className="text-[11px] text-gray-500 font-medium">{selectedEmp.role || "Thành viên"}</span>
                        </div>
                      </div>

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
                          className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 text-[11px]"
                        >
                          {uploadingAvatar ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                          <span>{uploadingAvatar ? "Đang tải..." : (editPhotoURL ? "Đổi ảnh đại diện" : "Tải ảnh đại diện")}</span>
                        </button>
                        {editPhotoURL && (
                          <button
                            type="button"
                            onClick={() => setEditPhotoURL("")}
                            title="Xóa avatar"
                            className="p-1.5 border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition cursor-pointer"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
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
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white font-medium"
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
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Lĩnh vực hoạt động</label>
                      <input
                        type="text"
                        placeholder="Ví dụ: Phần mềm & Chuyển đổi số"
                        value={editIndustry}
                        onChange={(e) => setEditIndustry(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                      />
                    </div>
                  </div>

                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <label className="block font-bold text-gray-600">Ảnh sản phẩm hoặc hoạt động</label>
                        <span className="text-[11px] text-slate-500">Tối đa 5 ảnh</span>
                      </div>
                      <input ref={editGalleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleEditGalleryFiles} />
                      <button
                        type="button"
                        onClick={() => editGalleryInputRef.current?.click()}
                        disabled={uploadingEditGallery || editGalleryImages.length >= MAX_MEMBER_GALLERY_IMAGES}
                        className="shrink-0 rounded-xl border border-sky-200 bg-white px-3 py-2 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                      >
                        {uploadingEditGallery ? "Đang tải..." : "Thêm ảnh"}
                      </button>
                    </div>
                    {editGalleryImages.length > 0 && (
                      <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                        {editGalleryImages.map((image, index) => (
                          <div key={`${image.url}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
                            <img src={image.url} alt={`Ảnh sản phẩm hoặc hoạt động ${index + 1}`} className="h-full w-full object-cover" />
                            <button
                              type="button"
                              onClick={() => setEditGalleryImages(previous => previous.filter((_, imageIndex) => imageIndex !== index))}
                              aria-label={`Xóa ảnh ${index + 1}`}
                              className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow hover:bg-rose-50 hover:text-rose-600"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Giới tính</label>
                      <select
                        aria-label="Giới tính"
                        value={editGender}
                        onChange={(e) => setEditGender(e.target.value as typeof editGender)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                      >
                        <option value="">Chưa cập nhật</option>
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                        <option value="other">Khác</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Thị trường mục tiêu</label>
                      <input
                        type="text"
                        maxLength={500}
                        value={editTargetMarket}
                        onChange={(e) => setEditTargetMarket(e.target.value)}
                        placeholder="Ví dụ: Doanh nghiệp vừa và nhỏ"
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block font-bold text-gray-500 mb-1">Địa chỉ</label>
                    <textarea
                      rows={2}
                      maxLength={300}
                      value={editAddress}
                      onChange={(e) => setEditAddress(e.target.value)}
                      placeholder="Nhập địa chỉ"
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white resize-y"
                    />
                  </div>

                  {/* Role in Chapter */}


                  {/* Phone & BirthDate */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Số điện thoại</label>
                      <input
                        type="text"
                        placeholder="090XXXXXXXX"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-gray-500 mb-1">Ngày sinh</label>
                      <VietnameseDatePicker
                        ariaLabel="Ngày sinh"
                        value={editBirthDate}
                        onChange={(val) => setEditBirthDate(val)}
                        placeholder="Chọn ngày sinh..."
                        className="w-full"
                        buttonClassName="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white text-xs font-normal"
                        align="right"
                      />
                    </div>
                  </div>

                  {/* Login email */}
                  <div>
                    <label htmlFor="member-edit-email" className="block font-bold text-gray-500 mb-1">Email đăng nhập *</label>
                    <input
                      id="member-edit-email"
                      type="email"
                      value={editEmail}
                      onChange={(event) => setEditEmail(event.target.value)}
                      autoComplete="email"
                      required
                      className="w-full px-3.5 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-700 bg-white"
                    />
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
                    disabled={isSaving || uploadingEditGallery}
                    onClick={handleEditEmployeeSave}
                    className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
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
                <div className="relative h-28 w-full overflow-hidden rounded-t-3xl bg-primary">
                  {memberCover && (
                    <img key={memberCover} src={memberCover} alt="" className="w-full h-full object-cover" onError={event => { event.currentTarget.style.display = "none"; }} />
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
                        className={`absolute bottom-1 right-1 w-4 h-4 rounded-full border-2 border-white ${selectedEmp.status === "online" ? "bg-emerald-500 animate-pulse" : "bg-slate-300"
                          }`}
                        title={selectedEmp.status === "online" ? "Đang hoạt động" : "Ngoại tuyến"}
                      />
                    </div>
                    <h3 className="font-extrabold text-xl text-slate-900 mt-2.5 font-sans leading-tight">
                      {memberName}
                    </h3>
                    <div className="flex flex-wrap items-center justify-center gap-2 mt-1.5">
                      <span className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-200 px-3 py-0.5 rounded-full">
                        {memberRole}
                      </span>

                    </div>
                  </div>

                  {/* Information Grid */}
                  <div className="mt-4 space-y-3 text-xs">
                    <div className="p-3.5 rounded-2xl bg-slate-50/80 border border-slate-150 grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      <div className="flex items-start gap-2.5">
                        <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
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
                        <UserRound className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Giới tính</span>
                          <strong className="text-slate-800 text-xs font-bold block">
                            {memberGender === "male" ? "Nam" : memberGender === "female" ? "Nữ" : memberGender === "other" ? "Khác" : "Chưa cập nhật"}
                          </strong>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5">
                        <Target className="w-4 h-4 text-cyan-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Thị trường mục tiêu</span>
                          <strong className="text-slate-800 text-xs font-bold block break-words">{memberTargetMarket}</strong>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 sm:col-span-2">
                        <MapPin className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Địa chỉ</span>
                          <strong className="text-slate-800 text-xs font-bold block break-words">{memberAddress}</strong>
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
                          <a href={`tel:${memberPhone}`} className="text-slate-800 hover:text-blue-600 text-xs font-bold block truncate">
                            {memberPhone}
                          </a>
                        </div>
                      </div>

                      <div className="flex items-start gap-2.5 sm:col-span-2">
                        <Mail className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                          <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email liên hệ</span>
                          <a href={`mailto:${memberEmail}`} className="text-slate-800 hover:text-blue-600 text-xs font-bold block truncate">
                            {memberEmail}
                          </a>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-slate-100 bg-white p-3.5">
                      <div className="mb-3 flex items-center justify-between gap-3">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Ảnh sản phẩm hoặc hoạt động</span>
                        <span className="text-[10px] text-slate-400">{memberGalleryImages.length}/5</span>
                      </div>
                      {memberGalleryImages.length > 0 ? (
                        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                          {memberGalleryImages.map((image, index) => (
                            <a key={`${image}-${index}`} href={image} target="_blank" rel="noreferrer" className="block aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
                              <img src={image} alt={`Ảnh sản phẩm hoặc hoạt động ${index + 1}`} className="h-full w-full object-cover transition-transform hover:scale-105" />
                            </a>
                          ))}
                        </div>
                      ) : (
                        <p className="text-xs text-slate-400">Chưa có ảnh</p>
                      )}
                    </div>

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
                                  className="flex items-center gap-3 bg-slate-50 hover:bg-blue-50/60 border border-slate-150 hover:border-blue-200 px-3 py-2 rounded-xl transition-all text-left cursor-pointer"
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
                  {userProfile?.role !== "superadmin" && <div className="pt-4 mt-4 border-t border-slate-100 flex flex-wrap gap-2.5">
                    <MemberMessageButton key={selectedEmp.id} memberId={selectedEmp.id} currentUserId={userProfile?.uid} onOpened={closeDetailModal} />
                    {canEditEmployee(selectedEmp.id) && (
                      <button
                        type="button"
                        onClick={startEditing}
                        className="flex-1 py-2.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-all cursor-pointer shadow-xs active:scale-95"
                      >
                        <Edit className="w-3.5 h-3.5" />
                        Chỉnh sửa thông tin
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
                  </div>}
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
              {/* Visual Cover Image & Avatar Preview Section */}
              <div className="relative rounded-2xl border border-slate-200 bg-slate-50 overflow-hidden shadow-xs">
                {/* Cover Banner */}
                <div className="relative h-28 sm:h-32 w-full bg-gradient-to-r from-blue-600 via-indigo-600 to-sky-500 overflow-hidden">
                  {addCoverImage ? (
                    <img
                      key={addCoverImage}
                      src={addCoverImage}
                      alt="Ảnh bìa"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLElement).style.display = "none";
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center gap-1 opacity-40 text-white">
                      <ImageIcon className="h-7 w-7" />
                      <span className="text-[10px] font-medium tracking-wide">Ảnh bìa thành viên</span>
                    </div>
                  )}
                  {/* Cover Image Action Buttons */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    <input
                      ref={addCoverFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAddCoverFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => addCoverFileInputRef.current?.click()}
                      disabled={uploadingAddCover}
                      className="px-2.5 py-1.5 bg-black/60 hover:bg-black/80 backdrop-blur-md text-white rounded-xl text-[11px] font-medium flex items-center gap-1.5 transition cursor-pointer shadow-xs disabled:opacity-50"
                    >
                      {uploadingAddCover ? (
                        <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                      <span>{uploadingAddCover ? "Đang tải..." : (addCoverImage ? "Đổi ảnh bìa" : "Tải ảnh bìa")}</span>
                    </button>
                    {addCoverImage && (
                      <button
                        type="button"
                        onClick={() => setAddCoverImage("")}
                        title="Xóa ảnh bìa"
                        className="p-1.5 bg-black/60 hover:bg-red-600 backdrop-blur-md text-white rounded-xl transition cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Avatar & Upload Bar */}
                <div className="px-4 pb-3.5 pt-2 flex flex-col sm:flex-row sm:items-end justify-between gap-3">
                  <div className="flex items-center gap-3.5 -mt-10 sm:-mt-12">
                    <div className="relative group shrink-0">
                      <div className="h-18 w-18 sm:h-20 sm:w-20 rounded-2xl border-4 border-white bg-white shadow-md overflow-hidden flex items-center justify-center">
                        {renderAvatar(addPhotoURL, "w-full h-full", "text-xl", addName || "Thành viên")}
                      </div>
                      <button
                        type="button"
                        onClick={() => addAvatarFileInputRef.current?.click()}
                        disabled={uploadingAddAvatar}
                        title="Tải ảnh đại diện"
                        className="absolute inset-0 bg-black/45 rounded-2xl flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-white"
                      >
                        {uploadingAddAvatar ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                      </button>
                    </div>
                    <div>
                      <span className="font-bold text-slate-800 text-sm block">{addName || "Thành viên mới"}</span>
                      <span className="text-[11px] text-gray-500 font-medium">{addCompanyName || "Công ty thành viên"}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="file"
                      ref={addAvatarFileInputRef}
                      accept="image/*"
                      className="hidden"
                      onChange={handleAddAvatarFileChange}
                    />
                    <button
                      type="button"
                      onClick={() => addAvatarFileInputRef.current?.click()}
                      disabled={uploadingAddAvatar}
                      className="px-3 py-1.5 bg-white border border-slate-200 hover:bg-slate-100 rounded-xl text-slate-700 font-bold flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 text-[11px]"
                    >
                      {uploadingAddAvatar ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                      <span>{uploadingAddAvatar ? "Đang tải..." : (addPhotoURL ? "Đổi ảnh đại diện" : "Tải ảnh đại diện")}</span>
                    </button>
                    {addPhotoURL && (
                      <button
                        type="button"
                        onClick={() => setAddPhotoURL("")}
                        title="Xóa avatar"
                        className="p-1.5 border border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-500 rounded-xl transition cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Họ tên thành viên *</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Nguyễn Văn A"
                  value={addName}
                  onChange={(e) => setAddName(e.target.value)}
                  className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-800"
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
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
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
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <label className="block font-bold text-gray-600">Ảnh sản phẩm hoặc hoạt động</label>
                    <span className="text-[11px] text-slate-500">Tối đa 5 ảnh</span>
                  </div>
                  <input ref={addGalleryInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAddGalleryFiles} />
                  <button
                    type="button"
                    onClick={() => addGalleryInputRef.current?.click()}
                    disabled={uploadingAddGallery || addGalleryImages.length >= MAX_MEMBER_GALLERY_IMAGES}
                    className="shrink-0 rounded-xl border border-sky-200 bg-white px-3 py-2 text-[11px] font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-50"
                  >
                    {uploadingAddGallery ? "Đang tải..." : "Thêm ảnh"}
                  </button>
                </div>
                {addGalleryImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {addGalleryImages.map((image, index) => (
                      <div key={`${image.url}-${index}`} className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-white">
                        <img src={image.url} alt={`Ảnh sản phẩm hoặc hoạt động ${index + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => setAddGalleryImages(previous => previous.filter((_, imageIndex) => imageIndex !== index))}
                          aria-label={`Xóa ảnh ${index + 1}`}
                          className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-white/95 text-slate-600 shadow hover:bg-rose-50 hover:text-rose-600"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Giới tính</label>
                  <select
                    aria-label="Giới tính"
                    value={addGender}
                    onChange={(e) => setAddGender(e.target.value as typeof addGender)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 bg-white"
                  >
                    <option value="">Chưa cập nhật</option>
                    <option value="male">Nam</option>
                    <option value="female">Nữ</option>
                    <option value="other">Khác</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Thị trường mục tiêu</label>
                  <input
                    type="text"
                    maxLength={500}
                    value={addTargetMarket}
                    onChange={(e) => setAddTargetMarket(e.target.value)}
                    placeholder="Ví dụ: Doanh nghiệp vừa và nhỏ"
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-gray-500 mb-1">Địa chỉ</label>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={addAddress}
                  onChange={(e) => setAddAddress(e.target.value)}
                  placeholder="Nhập địa chỉ"
                  className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 resize-y"
                />
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
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
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
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Ngày sinh</label>
                  <VietnameseDatePicker
                    ariaLabel="Ngày sinh"
                    value={addBirthDate}
                    onChange={(val) => setAddBirthDate(val)}
                    placeholder="Chọn ngày sinh..."
                    className="w-full"
                    buttonClassName="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800 text-xs font-normal"
                    align="right"
                  />
                </div>
                <div>
                  <label className="block font-bold text-gray-500 mb-1">Mật khẩu khởi tạo *</label>
                  <input
                    type="password"
                    required
                    placeholder="Tối thiểu 6 ký tự"
                    value={addPassword}
                    onChange={(e) => setAddPassword(e.target.value)}
                    className="w-full px-3.5 py-2 border rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-slate-800"
                  />
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
                disabled={isAddingEmployee || uploadingAddGallery}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl cursor-pointer transition-all active:scale-95 disabled:opacity-50 flex items-center gap-1.5 shadow-xs"
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
