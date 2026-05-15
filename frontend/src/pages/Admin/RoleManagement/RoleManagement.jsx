import React, { useState, useEffect } from 'react';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';
import { Plus, Edit2, Trash2, Search, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';
import ConfirmationModal from '../../../components/ConfirmationModal';
import Pagination from '../../../components/Pagination';
import GlobalSlideOver from '../../../components/GlobalSlideOver';
import RoleFormModal from './RoleFormModal';
import AssignRoleModal from './AssignRoleModal';
import { formatDate } from '../../../utils/dateUtils';
import { useAuth } from '../../../context/AuthContext';
import { TableElementStyle } from '../../../styles/tableStyles';

const RoleManagement = () => {
    const { user: currentUserData } = useAuth();
    const [roles, setRoles] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
    const [currentRole, setCurrentRole] = useState(null);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, total: 0, limit: 10 });

    const fetchRoles = async (page = 1) => {
        try {
            setLoading(true);
            const res = await api.get(`/roles?page=${page}&limit=${pagination.limit}&search=${searchTerm}`);
            if (res.data.success) {
                setRoles(res.data.data);
                setPagination(res.data.pagination);
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to load roles');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const timeoutId = setTimeout(() => {
            fetchRoles(1);
        }, searchTerm ? 500 : 0);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const handleOpenModal = (role = null) => {
        setCurrentRole(role);
        setIsModalOpen(true);
    };

    const handleCloseModal = () => {
        setIsModalOpen(false);
        setCurrentRole(null);
    };

    const handleDeleteClick = (id) => {
        setDeleteModal({ isOpen: true, id });
    };

    const handleDelete = async () => {
        const id = deleteModal.id;
        if (!id) return;
        try {
            const res = await api.delete(`/roles/${id}`);
            if (res.data.success) {
                toast.success('Role deleted successfully');
                fetchRoles(roles.length === 1 && pagination.currentPage > 1 ? pagination.currentPage - 1 : pagination.currentPage);
            }
            setDeleteModal({ isOpen: false, id: null });
        } catch (error) {
            toast.error(error.response?.data?.message || 'Delete failed');
            setDeleteModal({ isOpen: false, id: null });
        }
    };

    return (
        <div style={{ color: 'var(--text-main)' }} className="roles-page">
            <div className="table-container">
                <div className="search-management-header">
                    <div className="buddy-search-box hide-on-mobile">
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)', zIndex: 1 }} />
                        <input
                            type="text"
                            placeholder="Search roles..."
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="buddy-search-input"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button className="btn" onClick={() => setIsAssignModalOpen(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '0 16px', borderRadius: '12px', background: 'var(--bg-lite)', color: 'var(--text-main)', border: '1px solid var(--border-color)', cursor: 'pointer', fontWeight: 'bold' }}>
                            <span>Assign Roles</span>
                        </button>
                        <button
                            className="btn btn-primary mobile-fab"
                            onClick={() => handleOpenModal()}
                        >
                            <Plus size={20} />
                            <span className="hide-mobile-text">Add Role</span><span className="show-mobile-text">Add</span>
                        </button>
                    </div>
                </div>

                <div className="table-wrapper desktop-table-view">
                    <table style={TableElementStyle}>
                        <thead>
                            <tr>
                                <th style={{ width: '50px' }} className="buddy-th hide-mobile-th">S.No</th>
                                <th style={{ textAlign: 'left', minWidth: '150px' }} className="buddy-th">Role Name</th>
                                <th style={{ textAlign: 'left', minWidth: '200px' }} className="buddy-th hide-on-tablet">Description</th>
                                <th style={{ textAlign: 'center', width: '120px' }} className="buddy-th">User Count</th>
                                <th style={{ textAlign: 'center', width: '100px' }} className="buddy-th">Status</th>
                                <th style={{ width: '120px' }} className="buddy-th">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '100px 0' }}>
                                        <Loader2 className="animate-spin" color="var(--primary-color)" size={32} />
                                    </td>
                                </tr>
                            ) : roles.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '100px 0', color: 'var(--text-sub)' }}>
                                        No roles found.
                                    </td>
                                </tr>
                            ) : (
                                roles.map((role, index) => (
                                    <motion.tr
                                        key={role._id}
                                        whileHover={{ backgroundColor: 'var(--row-hover)' }}
                                        className="mobile-stacked-row"
                                    >
                                        <td style={{ borderLeft: 'none', textAlign: 'center', padding: '18px 10px' }} className="buddy-td hide-mobile-td">
                                            {(pagination.currentPage - 1) * pagination.limit + index + 1}
                                        </td>
                                        <td data-label="Role" className="buddy-td">
                                            <div style={{ fontWeight: '600', color: 'var(--text-main)', fontSize: '0.9rem' }}>{role.name}</div>
                                        </td>
                                        <td data-label="Description" className="buddy-td hide-on-tablet">
                                            <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{role.description || 'No description provided.'}</div>
                                        </td>
                                        <td style={{ textAlign: 'center' }} data-label="Users" className="buddy-td">
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                color: '#1E40AF',
                                                background: '#EFF6FF',
                                                padding: '4px 12px',
                                                borderRadius: '4px',
                                                border: '1px solid #DBEAFE',
                                                display: 'inline-block'
                                            }}>
                                                {role.userCount || 0}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center' }} data-label="Status" className="buddy-td">
                                            <span style={{
                                                fontSize: '0.65rem',
                                                fontWeight: '800',
                                                color: role.status === 'active' ? 'var(--success-color)' : 'var(--danger-color)',
                                                background: role.status === 'active' ? 'color-mix(in srgb, var(--success-color) 10%, transparent)' : 'color-mix(in srgb, var(--danger-color) 10%, transparent)',
                                                border: `1px solid ${role.status === 'active' ? 'color-mix(in srgb, var(--success-color) 20%, transparent)' : 'color-mix(in srgb, var(--danger-color) 20%, transparent)'}`,
                                                padding: '4px 12px',
                                                borderRadius: '4px',
                                                display: 'inline-block',
                                                textTransform: 'uppercase'
                                            }}>
                                                {role.status || 'Active'}
                                            </span>
                                        </td>
                                        <td style={{ borderLeft: 'none' }} className="buddy-td mobile-actions-cell">
                                            <div style={{ display: 'flex', justifyContent: 'center', gap: '6px' }}>
                                                <button
                                                    onClick={() => handleOpenModal(role)}
                                                    title="Edit"
                                                    className="btn btn-icon btn-sm"
                                                    style={{ color: 'var(--info-color)', background: 'color-mix(in srgb, var(--info-color) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--info-color) 15%, transparent)' }}
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                {!role.isSystem && (
                                                    <button
                                                        onClick={() => handleDeleteClick(role._id)}
                                                        title="Delete"
                                                        className="btn btn-icon btn-sm"
                                                        style={{ color: 'var(--danger-color)', background: 'color-mix(in srgb, var(--danger-color) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--danger-color) 15%, transparent)' }}
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                )}
                                            </div>
                                        </td>
                                    </motion.tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {!loading && <Pagination pagination={pagination} onPageChange={fetchRoles} />}
            </div>

            <GlobalSlideOver
                isOpen={isModalOpen}
                onClose={handleCloseModal}
                title={currentRole ? 'Edit Role Permissions' : 'Create New Role'}
                width="800px" // wider for matrix
            >
                <RoleFormModal role={currentRole} onClose={handleCloseModal} refresh={fetchRoles} />
            </GlobalSlideOver>

            <GlobalSlideOver
                isOpen={isAssignModalOpen}
                onClose={() => setIsAssignModalOpen(false)}
                title="Assign User Roles"
                width="500px" // narrower for assign search
            >
                <AssignRoleModal onClose={() => setIsAssignModalOpen(false)} refreshRoles={fetchRoles} />
            </GlobalSlideOver>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Role"
                message="Are you sure you want to delete this role? This cannot be undone."
                confirmText="Delete Role"
            />
        </div>
    );
};

export default RoleManagement;
