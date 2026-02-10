import { useState, useEffect } from 'react';
import api from '../services/api';
import CustomSelect from '../components/CustomSelect';
import { toast, Toaster } from 'react-hot-toast';
import {
    UserPlus, Edit2, Trash2, Search, X, Loader2, User as UserIcon, Mail, Phone, ShieldCheck, Eye, EyeOff
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConfirmationModal from '../components/ConfirmationModal';
import Pagination from '../components/Pagination';
import {
    ThStyle, TdStyle, ActionButtonStyle, TableContainerStyle, TableElementStyle, SearchBoxStyle, SearchInputStyle, TableRowStyle
} from '../components/TableStyles';

const ModalOverlay = {
    position: 'fixed',
    inset: 0,
    zIndex: 2000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px'
};

const ModalBackground = {
    position: 'absolute',
    inset: 0,
    background: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(10px)'
};

const AdminManagement = () => {
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
        fetchUsers(1);
        fetchRoles();
    }, []);

    // Debounced search
    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchUsers(1);
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

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
        } else {
            setCurrentUser(null);
            setFormData({
                name: '',
                email: '',
                password: '',
                phone: '',
                role: 'admin'
            });
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
            if (currentUser) {
                const res = await api.put(`/users/${currentUser._id}`, formData);
                if (res.data.success) {
                    toast.success('Admin updated', { id: toastId });
                    fetchUsers();
                    handleCloseModal();
                }
            } else {
                const res = await api.post('/users', formData);
                if (res.data.success) {
                    toast.success('Admin created', { id: toastId });
                    fetchUsers();
                    handleCloseModal();
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Action failed', { id: toastId });
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

            <div className="users-card table-responsive-container" style={TableContainerStyle}>
                <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '24px',
                    gap: '16px',
                    flexWrap: 'wrap'
                }}>
                    <div className="search-box" style={{ ...SearchBoxStyle, marginBottom: 0, flex: 1, minWidth: '200px' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                        <input
                            type="text"
                            placeholder="Search admins..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            style={SearchInputStyle}
                        />
                    </div>
                    <button
                        className="btn-primary"
                        onClick={() => handleOpenModal()}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '10px 20px',
                            whiteSpace: 'nowrap'
                        }}
                    >
                        <UserPlus size={20} />
                        <span className="hide-mobile-text">Add Admin</span><span className="show-mobile-text">Add</span>
                    </button>
                </div>

                <div className="table-wrapper">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...ThStyle, width: '50px', borderRadius: '12px 0 0 12px' }}>S.No</th>
                                <th style={{ ...ThStyle, textAlign: 'left', minWidth: '200px' }}>Admin Info</th>
                                <th className="hide-on-tablet" style={ThStyle}>Contact Details</th>
                                <th style={{ ...ThStyle, minWidth: '120px' }}>Work Role</th>
                                <th className="hide-on-mobile" style={ThStyle}>Join Date</th>
                                <th style={{ ...ThStyle, width: '120px', borderRadius: '0 12px 12px 0' }}>Actions</th>
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
                                        style={TableRowStyle()}
                                    >
                                        <td style={{ ...TdStyle, textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem', borderLeft: 'none', padding: '18px 10px' }}>{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div className="hide-on-mobile" style={{ width: '36px', height: '36px', background: 'var(--card-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                                    <UserIcon size={16} color="var(--primary-glow)" />
                                                </div>
                                                <div style={{ textAlign: 'left' }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', whiteSpace: 'nowrap' }}>
                                                        {user.name || (user.email === 'admin@example.com' ? 'Super Admin' : 'N/A')}
                                                    </div>
                                                    <div className="show-on-tablet" style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px' }}>{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hide-on-tablet" style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }}>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500', whiteSpace: 'nowrap' }}>{user.email}</div>
                                            {user.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px', whiteSpace: 'nowrap' }}>{user.phone}</div>}
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }}>
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
                                        <td className="hide-on-mobile" style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }}>
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
                                                {new Date(user.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none' }}>
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleOpenModal(user, true)}
                                                    title="View"
                                                    style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: '#10b981', background: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.2)' }}
                                                >
                                                    <Eye size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleOpenModal(user)}
                                                    title="Edit"
                                                    style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: 'var(--primary-glow)', background: 'color-mix(in srgb, var(--primary-color) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--primary-color) 20%, transparent)' }}
                                                >
                                                    <Edit2 size={12} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteClick(user._id)}
                                                    title="Delete"
                                                    style={{ ...ActionButtonStyle, width: '30px', height: '30px', color: '#ef4444', background: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}
                                                >
                                                    <Trash2 size={12} />
                                                </button>
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div style={ModalOverlay}>
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={handleCloseModal} style={ModalBackground} />
                        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} className="responsive-modal">
                            <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-color)' }}>
                                <h3 style={{ margin: 0, color: 'var(--text-main)', fontSize: '1.25rem' }}>
                                    {isViewMode ? 'View Admin' : (currentUser ? 'Edit Admin' : 'New Admin')}
                                </h3>
                                <button onClick={handleCloseModal} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-sub)' }}><X size={20} /></button>
                            </div>
                            <form onSubmit={handleSubmit} style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label className="modal-label">FULL NAME</label>
                                    <input className="modal-input" required disabled={isViewMode} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <label className="modal-label">EMAIL</label>
                                    <input className="modal-input" type="email" required disabled={isViewMode} value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                </div>
                                {!isViewMode && (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label className="modal-label">PASSWORD {currentUser && '(LEAVE BLANK TO UNCHANGED)'}</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                className="modal-input"
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
                                        {passwordError && <span style={{ color: '#ef4444', fontSize: '0.7rem' }}>{passwordError}</span>}
                                    </div>
                                )}
                                <div className="modal-row">
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label className="modal-label">PHONE</label>
                                        <input className="modal-input" disabled={isViewMode} value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    </div>
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <label className="modal-label">ROLE</label>
                                        <CustomSelect
                                            disabled={isViewMode}
                                            value={formData.role}
                                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                                            options={roles.length > 0 ? roles.filter(role => role.name !== 'user').map(role => ({
                                                value: role.name,
                                                label: role.name
                                            })) : [
                                                { value: 'admin', label: 'Admin' },
                                                { value: 'manager', label: 'Manager' }
                                            ]}
                                        />
                                    </div>
                                </div>
                                <div style={{ display: 'flex', gap: '12px', marginTop: '12px', flexDirection: window.innerWidth < 480 ? 'column' : 'row' }}>
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        style={{
                                            flex: 1,
                                            padding: '12px',
                                            borderRadius: '12px',
                                            border: '1px solid var(--border-color)',
                                            background: 'transparent',
                                            color: 'var(--text-sub)',
                                            fontWeight: '600'
                                        }}
                                        className="btn-outline"
                                    >
                                        {isViewMode ? 'Close' : 'Cancel'}
                                    </button>
                                    {!isViewMode && (
                                        <button
                                            type="submit"
                                            style={{ flex: 1 }}
                                            className="btn-primary"
                                        >
                                            Save Admin
                                        </button>
                                    )}
                                </div>
                            </form>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Admin"
                message="Are you sure you want to delete this admin? This action cannot be undone and they will lose all access immediately."
                confirmText="Delete Admin"
            />

            <style>{`
                .animate-spin { animation: spin 1s linear infinite; }
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                
                .table-wrapper {
                    overflow-x: auto;
                    width: 100%;
                }

                .modal-label {
                    font-size: 0.75rem; 
                    color: var(--text-sub); 
                    text-transform: uppercase; 
                    font-weight: 700; 
                    letter-spacing: 0.05em; 
                    display: block; 
                    margin-bottom: 4px;
                }

                .modal-input {
                    width: 100%; 
                    padding: 12px 16px; 
                    border-radius: 12px;
                    background: var(--bg-lite); 
                    border: 1px solid var(--border-color);
                    color: var(--text-main); 
                    font-size: 14px; 
                    outline: none;
                }

                .modal-row {
                    display: flex;
                    gap: 16px;
                }

                .responsive-modal {
                    position: relative;
                    width: 100%;
                    max-width: 500px;
                    background: var(--card-bg);
                    border-radius: 24px;
                    box-shadow: var(--card-shadow);
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                    backdrop-filter: blur(20px);
                }

                .show-mobile-text { display: none; }
                .show-on-tablet { display: none; }

                @media (max-width: 1024px) {
                    .hide-on-tablet { display: none !important; }
                    .show-on-tablet { display: block; }
                }
                
                @media (max-width: 768px) {
                    .table-responsive-container {
                        padding: 16px !important;
                    }
                    .hide-on-mobile { display: none !important; }
                    th, td { padding: 12px 10px !important; }
                    .responsive-modal {
                        width: 95%;
                    }
                    .modal-row {
                        flex-direction: column;
                        gap: 12px;
                    }
                    .hide-mobile-text { display: none; }
                    .show-mobile-text { display: inline-block; }
                }

                @media (max-width: 480px) {
                    .table-responsive-container {
                        border-radius: 16px !important;
                    }
                    td, th {
                        padding: 12px 8px !important;
                    }
                }
            `}</style>
        </div>
    );
};

export default AdminManagement;
