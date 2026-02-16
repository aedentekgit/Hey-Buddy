import { useState, useEffect } from 'react';
import api from '../services/api';
import CustomSelect from '../components/CustomSelect';
import { toast, Toaster } from 'react-hot-toast';
import {
    UserPlus, Edit2, Trash2, Search, X, Loader2, User as UserIcon, Eye, EyeOff, Save, Camera
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import {
    ThStyle, TdStyle, TableContainerStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle, TableRowStyle
} from '../components/TableStyles';
import MobileUserCard from '../components/MobileUserCard';
import GlobalSlideOver from '../components/GlobalSlideOver';

const Users = () => {
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
        role: 'user'
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
            const res = await api.get(`/users?page=${page}&limit=${pagination.limit}&search=${searchTerm}&role=user`);
            if (res.data.success) {
                setUsers(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            console.error('Fetch users failed:', error);
            const message = error.response?.data?.message || 'Failed to load users';
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
                setRoles(res.data.data);
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
                role: 'user'
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
        if (e) e.preventDefault();

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
                        toast.error("User saved, but profile picture failed to upload", { id: toastId });
                        fetchUsers();
                        handleCloseModal();
                        return;
                    }
                }

                toast.success(currentUser ? 'User updated' : 'User created', { id: toastId });
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
            // Update local users list logic matches fetchUsers
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
                toast.success('User deleted');
                fetchUsers();
            }
        } catch (error) {
            toast.error('Delete failed');
        }
    };

    // Search is now handled on the backend
    const filteredUsers = users;

    return (
        <div style={{ color: 'var(--text-main)' }} className="users-page">
            <Toaster position="top-right" />

            <div className="table-container">
                <div className="search-management-header">
                    <div className="buddy-search-box hide-on-mobile">
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search users..."
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
                        <span className="hide-mobile-text">Add User</span><span className="show-mobile-text">Add</span>
                    </button>
                </div>

                <div className="table-wrapper desktop-table-view">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ width: '64px', textAlign: 'center' }} className="buddy-th hide-mobile-th">S.NO</th>
                                <th style={{ width: '80px', textAlign: 'center' }} className="buddy-th">Profile</th>
                                <th style={{ textAlign: 'center', minWidth: '220px' }} className="buddy-th">User Identity</th>
                                <th style={{ textAlign: 'center' }} className="buddy-th hide-on-tablet">Contact & Communications</th>
                                <th style={{ minWidth: '130px', textAlign: 'center' }} className="buddy-th">Access Level</th>
                                <th style={{ textAlign: 'center' }} className="buddy-th hide-on-mobile">Provisioned On</th>
                                <th style={{ width: '140px', textAlign: 'center' }} className="buddy-th">Management</th>
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
                                        No users found.
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, index) => (
                                    <motion.tr
                                        key={user._id}
                                        whileHover={{ backgroundColor: 'var(--row-hover)' }}
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem', fontWeight: '800', padding: '16px 10px' }} className="buddy-td hide-mobile-td">
                                            {(pagination.currentPage - 1) * pagination.limit + index + 1}
                                        </td>
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
                                                        src={user.profilePicture.startsWith('http') ? user.profilePicture : `${import.meta.env.VITE_BACKEND_URL}${user.profilePicture}`}
                                                        alt={user.name}
                                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                    />
                                                ) : (
                                                    <UserIcon size={20} color="var(--text-sub)" />
                                                )}
                                            </div>
                                        </td>
                                        <td data-label="User" className="buddy-td">
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
                                                <div style={{ textAlign: 'center', minWidth: 0 }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.875rem', lineHeight: '1.2' }}>
                                                        {user.name || (user.email === 'admin@example.com' ? 'System Administrator' : 'Pending Name')}
                                                    </div>
                                                    <div style={{ fontSize: '0.7rem', color: 'var(--text-sub)', marginTop: '2px', letterSpacing: '0.01em' }}>
                                                        ID: {user._id?.slice(-8).toUpperCase()}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="buddy-td hide-on-tablet" data-label="Contact">
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500' }}>{user.email}</div>
                                            {user.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '1px' }}>{user.phone}</div>}
                                        </td>
                                        <td style={{ textAlign: 'center' }} data-label="Role" className="buddy-td">
                                            <span style={{
                                                padding: '4px 10px',
                                                borderRadius: '4px',
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                textTransform: 'uppercase',
                                                letterSpacing: '0.05em',
                                                background: user.role === 'admin' ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'var(--bg-lite)',
                                                color: user.role === 'admin' ? 'var(--primary-color)' : 'var(--text-sub)',
                                                border: `1px solid ${user.role === 'admin' ? 'color-mix(in srgb, var(--primary-color) 20%, transparent)' : 'var(--border-color)'}`,
                                                display: 'inline-block',
                                                minWidth: '64px'
                                            }}>{user.role}</span>
                                        </td>
                                        <td className="buddy-td hide-on-mobile" data-label="Joined">
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-sub)', fontWeight: '500' }}>
                                                {new Date(user.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td className="buddy-td mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                                                <button
                                                    onClick={() => handleOpenModal(user, true)}
                                                    title="Quick View"
                                                    className="btn btn-icon btn-sm"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--primary-color)',
                                                        background: 'transparent',
                                                        border: '1px solid var(--border-color)'
                                                    }}
                                                >
                                                    <Eye size={14} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    title="Modify"
                                                    className="btn btn-icon btn-sm"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--secondary-color)',
                                                        background: 'transparent',
                                                        border: '1px solid var(--border-color)'
                                                    }}
                                                >
                                                    <Edit2 size={14} />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirm({ isOpen: true, userId: user._id })}
                                                    title="Terminate"
                                                    className="btn btn-icon btn-sm"
                                                    style={{
                                                        width: '32px',
                                                        height: '32px',
                                                        borderRadius: 'var(--radius-sm)',
                                                        color: 'var(--danger-color)',
                                                        background: 'transparent',
                                                        border: '1px solid var(--border-color)'
                                                    }}
                                                >
                                                    <Trash2 size={14} />
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
                <div className="mobile-card-view" style={{ marginTop: '16px' }}>
                    {loading ? (
                        <div style={{ padding: '40px 0', display: 'flex', justifyContent: 'center' }}>
                            <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                        </div>
                    ) : filteredUsers.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-sub)' }}>
                            No users found.
                        </div>
                    ) : (
                        filteredUsers.map(user => (
                            <MobileUserCard
                                key={user._id}
                                user={user}
                                onEdit={() => handleOpenModal(user)}
                                onView={() => handleOpenModal(user, true)}
                                onDelete={() => setDeleteModal({ isOpen: true, id: user._id })}
                            />
                        ))
                    )}
                </div>

                {!loading && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
            </div>

            <GlobalSlideOver
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={isViewMode ? 'View User' : (currentUser ? 'Edit User' : 'New User')}
                actionButton={!isViewMode ? {
                    label: 'Save User',
                    icon: <Save size={18} />,
                    onClick: handleSubmit
                } : null}
            >
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px', paddingBottom: '24px' }}>

                    {/* Profile Picture Upload Section */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
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
                                    src={previewImage.startsWith('http') || previewImage.startsWith('blob') ? previewImage : `${import.meta.env.VITE_BACKEND_URL}${previewImage}`}
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

                    <div className="form-group">
                        <label className="form-label">FULL NAME</label>
                        <input className="input" required disabled={isViewMode} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                    </div>
                    <div className="form-group">
                        <label className="form-label">EMAIL</label>
                        <input className="input" type="email" required disabled={isViewMode} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                    </div>
                    {!isViewMode && (
                        <div className="form-group">
                            <label className="form-label">PASSWORD {currentUser && '(LEAVE BLANK TO UNCHANGED)'}</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    className="input"
                                    type={showPassword ? "text" : "password"}
                                    style={{ paddingRight: '40px' }}
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
                                        right: '10px',
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
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                            {passwordError && <span className="form-error">{passwordError}</span>}
                        </div>
                    )}
                    <div style={{ display: 'flex', gap: '16px', flexDirection: 'column' }}>
                        <div style={{ flex: 1 }}>
                            <label className="form-label">PHONE</label>
                            <input className="input" disabled={isViewMode} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                        </div>
                        <div style={{ flex: 1 }}>
                            <label className="form-label">ROLE</label>
                            <CustomSelect
                                disabled={isViewMode}
                                value={formData.role}
                                onChange={e => setFormData({ ...formData, role: e.target.value })}
                                options={roles.length > 0 ? roles.map(role => ({
                                    value: role.name,
                                    label: role.name
                                })) : [
                                    { value: 'admin', label: 'Admin' },
                                    { value: 'user', label: 'User' }
                                ]}
                            />
                        </div>
                    </div>
                </form>
            </GlobalSlideOver>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete User"
                message="Are you sure you want to delete this user? This action cannot be undone and the user will lose all access immediately."
                confirmText="Delete User"
            />

        </div >
    );
};

export default Users;
