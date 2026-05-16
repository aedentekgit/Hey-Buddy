import { useState, useEffect } from 'react';
import api from '../services/api';
import CustomSelect from '../components/CustomSelect';
import { toast } from 'react-hot-toast';
import {
    UserPlus, Edit2, Trash2, Search, Loader2, User as UserIcon, Mail, Phone, ShieldCheck, Eye, EyeOff, Save, Camera
} from 'lucide-react';
import { motion } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import MobileUserCard from '../components/MobileUserCard';
import GlobalSlideOver from '../components/GlobalSlideOver';
import { formatDate } from '../utils/dateUtils';
import { useAuth } from '../context/AuthContext';
import { getImageUrl } from '../utils/imageUrl';
import { TableElementStyle
} from '../styles/tableStyles';


const AdminManagement = () => {
    const { user: currentUserData } = useAuth();
    const [users, setUsers] = useState([]);
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentUser, setCurrentUser] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        phone: '',
        role: 'admin'
    });
    const [profileImage, setProfileImage] = useState(null);
    const [previewImage, setPreviewImage] = useState(null);

    const [showPassword, setShowPassword] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
    const [isViewMode, setIsViewMode] = useState(false);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        total: 0,
        limit: 10
    });

    const validatePassword = (pass) => {
        if (!pass) return null;
        if (pass.length < 8) return 'Password must be at least 8 characters';
        if (!/\d/.test(pass)) return 'Password must contain at least one number';
        return null;
    };

    const fetchUsers = async (page = 1) => {
        try {
            setLoading(true);
            // Fetch users where role is NOT 'user'
            const res = await api.get(`/users?page=${page}&limit=${pagination.limit}&search=${searchTerm}&role=!user`);
            if (res.data.success) {
                setUsers(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error('Fetch admins failed:', error);
            const message = error.response?.data?.message || 'Failed to load admins';
            toast.error(message);
        } finally {
            setLoading(false);
        }
    };

    const handlePageChange = (newPage) => {
        fetchUsers(newPage);
    };

    const fetchRoles = async () => {
        try {
            const res = await api.get('/roles');
            if (res.data.success) {
                // Filter out 'user' role from the options so we only create admins/managers here
                setRoles(res.data.data.filter(r => r.name !== 'user'));
            }
        } catch (error) {
            console.error('Fetch roles failed:', error);
        }
    };

    useEffect(() => {
        fetchRoles();
    }, []);

    // Unified fetch on mount and search
    useEffect(() => {
        const delay = searchTerm === '' ? 0 : 500;
        const timeoutId = setTimeout(() => {
            fetchUsers(1);
        }, delay);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    useEffect(() => {
        const handleGlobalSearch = (e) => {
            setSearchTerm(e.detail);
        };
        window.addEventListener('buddy-search', handleGlobalSearch);
        return () => window.removeEventListener('buddy-search', handleGlobalSearch);
    }, []);

    const handleOpenModal = (user = null, isView = false) => {
        setIsViewMode(isView);
        if (user) {
            setCurrentUser(user);
            setFormData({
                name: user.name || '',
                email: user.email || '',
                password: '',
                phone: user.phone || '',
                role: user.role || 'admin'
            });
            setPreviewImage(user.profilePicture || null);
            setProfileImage(null);
        } else {
            setCurrentUser(null);
            setFormData({
                name: '',
                email: '',
                password: '',
                phone: '',
                role: 'admin'
            });
            setPreviewImage(null);
            setProfileImage(null);
        }
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentUser(null);
        setIsViewMode(false);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Password Validation
        if (!currentUser && !formData.password) {
            toast.error("Password is required");
            return;
        }
        if (formData.password) {
            const error = validatePassword(formData.password);
            if (error) {
                toast.error(error);
                return;
            }
        }

        const toastId = toast.loading(currentUser ? 'Updating...' : 'Creating...');
        try {
            let userId = currentUser ? currentUser._id : null;
            let res;

            if (currentUser) {
                res = await api.put(`/users/${currentUser._id}`, formData);
            } else {
                res = await api.post('/users', formData);
                if (res.data.success) {
                    userId = res.data.data._id;
                }
            }

            if (res.data.success) {
                // Upload Profile Picture if selected
                if (profileImage && userId) {
                    const formDataObj = new FormData();
                    formDataObj.append('profilePicture', profileImage);
                    try {
                        await api.post(`/users/${userId}/avatar`, formDataObj, {
                            headers: { 'Content-Type': 'multipart/form-data' }
                        });
                    } catch (uploadError) {
                        console.error("Profile upload failed", uploadError);
                        toast.error("Admin saved, but profile picture failed to upload", { id: toastId });
                        fetchUsers();
                        handleCloseModal();
                        return;
                    }
                }

                toast.success(currentUser ? 'Admin updated' : 'Admin created', { id: toastId });
                fetchUsers();
                handleCloseModal();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed', { id: toastId });
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setProfileImage(file);
            setPreviewImage(URL.createObjectURL(file));
        }
    };

    const handleRemoveProfilePicture = async () => {
        if (!currentUser) {
            setProfileImage(null);
            setPreviewImage(null);
            return;
        }

        try {
            await api.delete(`/users/${currentUser._id}/avatar`);
            setPreviewImage(null);
            setProfileImage(null);
            toast.success("Profile picture removed");
            setUsers(prev => prev.map(u => u._id === currentUser._id ? { ...u, profilePicture: null } : u));
        } catch (error) {
            toast.error("Failed to remove profile picture");
        }
    };

    const handleDeleteClick = (id) => {
        setDeleteModal({ isOpen: true, id });
    };

    const handleDelete = async () => {
        const id = deleteModal.id;
        if (!id) return;

        try {
            const res = await api.delete(`/users/${id}`);
            if (res.data.success) {
                toast.success('Admin deleted');
                // Refresh the current page from the backend
                if (users.length === 1 && pagination.currentPage > 1) {
                    fetchUsers(pagination.currentPage - 1);
                } else {
                    fetchUsers(pagination.currentPage);
                }
            }
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    // Search is now handled on the backend
    const filteredUsers = users;

    return (
        <div style={{ color: 'var(--text-main)' }} className="admin-management-page">
            <div className="table-container">
                <div className="search-management-header">
                    <div className="buddy-search-box hide-on-mobile">
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search admins..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="buddy-search-input"
                        />
                    </div>
                    <button
                        className="btn btn-primary mobile-fab"
                        onClick={() => handleOpenModal()}
                    >
                        <UserPlus size={20} />
                        <span className="hide-mobile-text">Add Admin</span><span className="show-mobile-text">Add</span>
                    </button>
                </div>

                <div className="table-wrapper desktop-table-view">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ width: '64px', textAlign: 'center' }} className="buddy-th hide-mobile-th">S.NO</th>
                                <th style={{ width: '80px', textAlign: 'center' }} className="buddy-th">Profile</th>
                                <th style={{ textAlign: 'center', minWidth: '200px' }} className="buddy-th">Admin Info</th>
                                <th className="buddy-th hide-on-tablet">Contact Details</th>
                                <th style={{ minWidth: '120px' }} className="buddy-th">Work Role</th>
                                <th className="buddy-th hide-on-mobile">Join Date</th>
                                <th style={{ width: '120px' }} className="buddy-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '100px 0' }}>
                                        <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                                    </td>
                                </tr>
                            ) : filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-sub)' }}>
                                        No admins found.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, index) => (
                                    <motion.tr
                                        key={user._id}
                                        whileHover={{ backgroundColor: 'color-mix(in srgb, var(--primary-color) 4%, transparent)' }}
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem', borderLeft: 'none', padding: '18px 10px' }} className="buddy-td hide-mobile-td">{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td className="buddy-td" style={{ textAlign: 'center' }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '50%',
                                                overflow: 'hidden',
                                                margin: '0 auto',
                                                border: '1px solid var(--border-color)',
                                                background: 'var(--bg-lite)',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center'
                                            }}>
                                                {user.profilePicture ? (
                                                    <img
                                                        src={getImageUrl(user.profilePicture)}
                                                        alt={user.name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <UserIcon size={20} color="var(--text-sub)" />
                                                )}
                                            </div>
                                        </td>
                                        <td style={{ borderLeft: 'none', borderRight: 'none' }} data-label="Admin" className="buddy-td">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                <div style={{ textAlign: 'center', minWidth: 0 }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', wordBreak: 'break-word', lineHeight: '1.2' }}>
                                                        {user.name || (user.email === 'admin@example.com' ? 'Super Admin' : 'N/A')}
                                                    </div>
                                                    <div className="show-on-tablet" style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px', wordBreak: 'break-all' }}>{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="buddy-td hide-on-tablet" style={{ borderLeft: 'none', borderRight: 'none' }} data-label="Contact">
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500', wordBreak: 'break-all' }}>{user.email}</div>
                                            {user.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px', wordBreak: 'break-all' }}>{user.phone}</div>}
                                        </td>
                                        <td style={{ borderLeft: 'none', borderRight: 'none' }} data-label="Role" className="buddy-td">
                                            <span style={{
                                                padding: '4px 12px',
                                                borderRadius: '8px',
                                                fontSize: '0.7rem',
                                                fontWeight: 'bold',
                                                textTransform: 'uppercase',
                                                background: user.role === 'admin' ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'var(--bg-lite)',
                                                color: user.role === 'admin' ? 'var(--primary-glow)' : 'var(--text-sub)',
                                                border: `1px solid ${user.role === 'admin' ? 'color-mix(in srgb, var(--primary-color) 30%, transparent)' : 'var(--border-color)'}`,
                                                display: 'inline-block',
                                                minWidth: '60px'
                                            }}>{user.role}</span>
                                        </td>
                                        <td className="buddy-td hide-on-mobile-custom" style={{ borderLeft: 'none', borderRight: 'none' }} data-label="Joined">
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
                                                {formatDate(user.createdAt, currentUserData?.dateFormat)}
                                            </div>
                                        </td>
                                        <td style={{ borderLeft: 'none' }} className="buddy-td mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleOpenModal(user, true)}
                                                    title="View"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--success-color)', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                                                >
                                                    <Eye size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    title="Edit"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--info-color)', background: 'rgba(59, 130, 246, 0.1)', borderColor: 'rgba(59, 130, 246, 0.2)' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(user._id)}
                                                    title="Delete"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--danger-color)', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile Card View */}
                <div className="mobile-card-view">
                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-sub)' }}>
                            No admins found.
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <MobileUserCard
                                key={user._id}
                                user={user}
                                onView={() => handleOpenModal(user, true)}
                                onEdit={() => handleOpenModal(user)}
                                onDelete={() => handleDeleteClick(user._id)}
                            />
                        ))
                    )}
                </div>

                {!loading && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
            </div>

            <GlobalSlideOver
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={isViewMode ? 'View Admin' : (currentUser ? 'Edit Admin' : 'New Admin')}
                actionButton={!isViewMode ? {
                    label: currentUser ? 'Save Admin' : 'Create Admin',
                    icon: <Save size={18} />,
                    onClick: handleSubmit
                } : null}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                    <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>

                        {/* Profile Picture Upload Section */}
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                            <div style={{
                                width: '100px',
                                height: '100px',
                                borderRadius: '50%',
                                background: 'var(--bg-lite)',
                                border: '2px dashed var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden',
                                position: 'relative'
                            }}>
                                {previewImage ? (
                                    <img
                                        src={getImageUrl(previewImage)}
                                        alt="Preview"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <UserIcon size={40} color="var(--text-sub)" />
                                )}
                            </div>

                            {!isViewMode && (
                                <div style={{ display: 'flex', gap: '10px' }}>
                                    <label className="btn btn-sm btn-secondary" style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <Camera size={14} />
                                        <span>{previewImage ? 'Change' : 'Upload'}</span>
                                        <input type="file" hidden accept="image/*" onChange={handleFileChange} />
                                    </label>
                                    {previewImage && (
                                        <button
                                            type="button"
                                            className="btn btn-sm btn-danger"
                                            onClick={handleRemoveProfilePicture}
                                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                                        >
                                            <Trash2 size={14} />
                                            <span>Remove</span>
                                        </button>
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="form-group" style={{ marginBottom: '16px' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>FULL NAME</label>
                            <input
                                className="input"
                                required
                                disabled={isViewMode}
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                style={{
                                    width: '100%',
                                    padding: '12px',
                                    borderRadius: '12px',
                                    border: '1px solid var(--border-color)',
                                    background: 'var(--bg-lite)',
                                    color: 'var(--text-main)',
                                    fontSize: '1rem'
                                }}
                            />
                        </div>

                        <div className="form-group" style={{ marginBottom: '24px' }}>
                            <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>EMAIL ADDRESS</label>
                            <div style={{ position: 'relative' }}>
                                <Mail size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                                <input
                                    className="input"
                                    type="email"
                                    required
                                    disabled={isViewMode}
                                    value={formData.email}
                                    onChange={e => setFormData({ ...formData, email: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: '12px 12px 12px 40px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-lite)',
                                        color: 'var(--text-main)',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                        {!isViewMode && (
                            <div className="form-group" style={{ marginBottom: '24px' }}>
                                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>PASSWORD {currentUser && '(LEAVE BLANK TO UNCHANGED)'}</label>
                                <div style={{ position: 'relative' }}>
                                    <ShieldCheck size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                                    <input
                                        className="input"
                                        type={showPassword ? "text" : "password"}
                                        style={{
                                            width: '100%',
                                            padding: '12px 40px 12px 40px',
                                            borderRadius: '12px',
                                            border: `1px solid ${passwordError ? 'var(--danger-color)' : 'var(--border-color)'}`,
                                            background: 'var(--bg-lite)',
                                            color: 'var(--text-main)',
                                            fontSize: '1rem'
                                        }}
                                        placeholder="Enter password..."
                                        required={!currentUser}
                                        value={formData.password}
                                        onChange={e => {
                                            setFormData({ ...formData, password: e.target.value });
                                            setPasswordError(validatePassword(e.target.value) || '');
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        style={{
                                            position: 'absolute',
                                            right: '12px',
                                            top: '50%',
                                            transform: 'translateY(-50%)',
                                            background: 'none',
                                            border: 'none',
                                            cursor: 'pointer',
                                            color: 'var(--text-sub)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            padding: 0
                                        }}
                                    >
                                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                                {passwordError && <span className="form-error" style={{ color: 'var(--danger-color)', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>{passwordError}</span>}
                            </div>
                        )}

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                            <div style={{ flex: 1 }}>
                                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>PHONE (OPTIONAL)</label>
                                <div style={{ position: 'relative' }}>
                                    <Phone size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                                    <input
                                        className="input"
                                        disabled={isViewMode}
                                        value={formData.phone}
                                        onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: '12px 12px 12px 40px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)',
                                            background: 'var(--bg-lite)',
                                            color: 'var(--text-main)',
                                            fontSize: '1rem'
                                        }}
                                    />
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <label className="form-label" style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>ROLE ASSIGNMENT</label>
                                <CustomSelect
                                    disabled={isViewMode}
                                    value={formData.role}
                                    onChange={e => setFormData({ ...formData, role: e.target.value })}
                                    options={roles.length > 0 ? roles.filter(role => role.name !== 'user').map(role => ({
                                        value: role.name,
                                        label: role.name
                                    })) : [
                                        { value: 'admin', label: 'Admin' }
                                    ]}
                                    style={{
                                        width: '100%',
                                        padding: '12px',
                                        borderRadius: '12px',
                                        border: '1px solid var(--border-color)',
                                        background: 'var(--bg-lite)',
                                        color: 'var(--text-main)',
                                        fontSize: '1rem'
                                    }}
                                />
                            </div>
                        </div>

                    </div>

                    {!isViewMode && (
                        <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)' }}>
                            <button
                                type="submit"
                                className="btn btn-primary"
                                style={{
                                    width: '100%',
                                    padding: '14px',
                                    borderRadius: '12px',
                                    fontSize: '1rem',
                                    fontWeight: '700',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px'
                                }}
                            >
                                <Save size={18} />
                                {currentUser ? 'Update Admin Account' : 'Create Admin Account'}
                            </button>
                        </div>
                    )}
                </form>
            </GlobalSlideOver>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Admin"
                message="Are you sure you want to delete this admin? This action cannot be undone and they will lose all access immediately."
                confirmText="Delete Admin"
            />



        </div>
    );
};

export default AdminManagement;
