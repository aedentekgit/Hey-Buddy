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
    ThStyle, TdStyle, TableElementStyle, SearchInputStyle, SearchBoxStyle, TableRowStyle
} from '../components/TableStyles';


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
        <div style={{ color: 'var(--text-main)' }} className="admin-management-page">
            <Toaster position="top-right" />

            <div className="table-container">
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
                        className="btn btn-primary"
                        onClick={() => handleOpenModal()}
                    >
                        <UserPlus size={20} />
                        <span className="hide-mobile-text">Add Admin</span><span className="show-mobile-text">Add</span>
                    </button>
                </div>

                <div className="table-wrapper">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ ...ThStyle, width: '50px', borderRadius: '12px 0 0 12px' }} className="hide-mobile-th">S.No</th>
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
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ ...TdStyle, textAlign: 'center', color: 'var(--text-sub)', fontSize: '0.8rem', borderLeft: 'none', padding: '18px 10px' }} className="hide-mobile-td">{(pagination.currentPage - 1) * pagination.limit + index + 1}</td>
                                        <td style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }} data-label="Admin">
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <div className="hide-on-mobile" style={{ width: '36px', height: '36px', background: 'var(--card-bg)', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                                                    <UserIcon size={16} color="var(--primary-glow)" />
                                                </div>
                                                <div style={{ textAlign: 'left', minWidth: 0 }}>
                                                    <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem', wordBreak: 'break-word', lineHeight: '1.2' }}>
                                                        {user.name || (user.email === 'admin@example.com' ? 'Super Admin' : 'N/A')}
                                                    </div>
                                                    <div className="show-on-tablet" style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '4px', wordBreak: 'break-all' }}>{user.email}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="hide-on-tablet" style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }} data-label="Contact">
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', fontWeight: '500', wordBreak: 'break-all' }}>{user.email}</div>
                                            {user.phone && <div style={{ fontSize: '0.75rem', color: 'var(--text-sub)', marginTop: '2px', wordBreak: 'break-all' }}>{user.phone}</div>}
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }} data-label="Role">
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
                                        <td className="hide-on-mobile-custom" style={{ ...TdStyle, borderLeft: 'none', borderRight: 'none' }} data-label="Joined">
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)', whiteSpace: 'nowrap' }}>
                                                {new Date(user.createdAt).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })}
                                            </div>
                                        </td>
                                        <td style={{ ...TdStyle, borderLeft: 'none' }} className="mobile-actions-cell">
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

                {!loading && <Pagination pagination={pagination} onPageChange={handlePageChange} />}
            </div>

            <AnimatePresence>
                {isModalOpen && (
                    <div className="modal-backdrop" onClick={handleCloseModal}>
                        <motion.div
                            initial={{ scale: 0.95, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.95, opacity: 0 }}
                            className="modal"
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h3 className="modal-title">
                                    {isViewMode ? 'View Admin' : (currentUser ? 'Edit Admin' : 'New Admin')}
                                </h3>
                                <button onClick={handleCloseModal} className="modal-close">
                                    <X size={20} />
                                </button>
                            </div>
                            <form onSubmit={handleSubmit}>
                                <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
                                    <div style={{ display: 'flex', gap: '16px' }}>
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
                                                options={roles.length > 0 ? roles.filter(role => role.name !== 'user').map(role => ({
                                                    value: role.name,
                                                    label: role.name
                                                })) : [
                                                    { value: 'admin', label: 'Admin' }
                                                ]}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="modal-footer">
                                    <button
                                        type="button"
                                        onClick={handleCloseModal}
                                        className="btn btn-secondary"
                                    >
                                        {isViewMode ? 'Close' : 'Cancel'}
                                    </button>
                                    {!isViewMode && (
                                        <button
                                            type="submit"
                                            className="btn btn-primary"
                                        >
                                            {currentUser ? 'Save Admin' : 'Create Admin'}
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
                
                .show-mobile-text { display: none; }
                .show-on-tablet { display: none; }

                @media (max-width: 1024px) {
                    .hide-on-tablet { display: none !important; }
                    .show-on-tablet { display: block; }
                }
                
                @media (max-width: 640px) {
                    .table-wrapper table, 
                    .table-wrapper thead, 
                    .table-wrapper tbody, 
                    .table-wrapper th, 
                    .table-wrapper td, 
                    .table-wrapper tr {
                        display: block;
                    }

                    .table-wrapper thead tr {
                        position: absolute;
                        top: -9999px;
                        left: -9999px;
                    }

                    .mobile-stacked-row {
                        background: linear-gradient(145deg, rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.01) 100%) !important;
                        border: 1px solid rgba(255, 255, 255, 0.05) !important;
                        border-radius: 24px !important;
                        padding: 20px !important;
                        margin-bottom: 24px !important;
                        box-shadow: 0 10px 30px rgba(0, 0, 0, 0.2) !important;
                        backdrop-filter: blur(10px);
                        position: relative;
                        overflow: hidden;
                    }

                    /* Add a subtle highlight accent */
                    .mobile-stacked-row::before {
                        content: '';
                        position: absolute;
                        top: 0;
                        left: 0;
                        width: 4px;
                        height: 100%;
                        background: var(--primary-color);
                        opacity: 0.5;
                    }

                    .table-wrapper td {
                        border: none !important;
                        padding: 12px 0 !important;
                        position: relative;
                        text-align: left !important;
                        width: 100% !important;
                        display: flex;
                        justify-content: space-between;
                        align-items: center;
                        gap: 16px;
                        min-height: auto !important;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.02) !important;
                    }

                    .table-wrapper td:last-child {
                        border-bottom: none !important;
                    }

                    .table-wrapper td::before {
                        content: attr(data-label);
                        font-size: 0.75rem;
                        font-weight: 700;
                        text-transform: uppercase;
                        letter-spacing: 0.05em;
                        color: var(--text-sub);
                        min-width: 100px;
                        opacity: 0.8;
                    }

                    /* Make the value text aligned to the right */
                    .table-wrapper td > * {
                        text-align: right;
                        flex: 1;
                        display: flex;
                        justify-content: flex-end;
                    }

                    /* Specific adjustment for Admin Info to keep avatar and text together aligned right */
                    .table-wrapper td[data-label="Admin"] > div {
                        width: 100%;
                    }

                    .hide-mobile-th, .hide-mobile-td {
                        display: none !important;
                    }

                    .hide-on-mobile-custom {
                         display: none !important;
                    }

                    .mobile-actions-cell {
                        margin-top: 8px;
                        padding-top: 20px !important;
                        border-top: 1px solid rgba(255, 255, 255, 0.05) !important;
                        justify-content: center !important;
                        gap: 16px !important;
                    }

                    .mobile-actions-cell::before {
                        display: none; /* Hide label for actions */
                    }
                    
                    /* Custom Button Styles for Mobile Actions */
                    .mobile-actions-cell .btn-icon {
                        width: 42px;
                        height: 42px;
                        border-radius: 12px;
                    }

                    .hide-on-tablet {
                        display: flex !important;
                    }


                    
                    .table-wrapper {
                        padding: 0 4px;
                        overflow-x: visible !important;
                    }

                    /* Ensure text breaks properly */
                    .table-wrapper td div {
                        word-break: break-word;
                    }
                }

                @media (max-width: 768px) {
                    /* We override the .hide-on-mobile class for the avatar specifically inside the table on mobile */
                    .table-wrapper .hide-on-mobile {
                        display: flex !important;
                    }

                    .hide-mobile-text { display: none; }
                    .show-mobile-text { display: inline-block; }
                }

                @media (max-width: 480px) {
                    td, th {
                        padding: 12px 4px !important;
                    }
                }
            `}</style>
        </div >
    );
};

export default AdminManagement;
