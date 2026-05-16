import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';
import { Search, Loader2, UserCheck } from 'lucide-react';

const AssignRoleModal = ({ onClose, refreshRoles }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(false);
    const [selectedUserIds, setSelectedUserIds] = useState([]);
    const [roles, setRoles] = useState([]);
    const [selectedRole, setSelectedRole] = useState('');
    const [assigning, setAssigning] = useState(false);

    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const roleRes = await api.get('/roles?limit=100');
                if (roleRes.data.success) {
                    setRoles(roleRes.data.data);
                    if (roleRes.data.data.length > 0) setSelectedRole(roleRes.data.data[0].name);
                }
            } catch (error) {
                toast.error('Failed to load roles');
            }
        };
        fetchInitialData();
    }, []);

    useEffect(() => {
        const fetchUsers = async () => {
            if (!searchTerm.trim()) {
                setUsers([]);
                return;
            }
            try {
                setLoading(true);
                const res = await api.get(`/users?search=${searchTerm}&limit=10`);
                if (res.data.success) {
                    setUsers(res.data.data);
                }
            } catch (error) {
                toast.error('Failed to search users');
            } finally {
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            fetchUsers();
        }, 500);
        return () => clearTimeout(timeoutId);
    }, [searchTerm]);

    const handleToggleUser = (userId) => {
        if (selectedUserIds.includes(userId)) {
            setSelectedUserIds(selectedUserIds.filter(id => id !== userId));
        } else {
            setSelectedUserIds([...selectedUserIds, userId]);
        }
    };

    const handleAssign = async () => {
        if (!selectedRole) {
            toast.error('Please select a role');
            return;
        }
        if (selectedUserIds.length === 0) {
            toast.error('Please select at least one user');
            return;
        }

        setAssigning(true);
        const toastId = toast.loading('Assigning roles...');

        try {
            await Promise.all(selectedUserIds.map(userId => 
                api.post('/roles/assign', { userId, roleName: selectedRole })
            ));
            
            toast.success(`Role assigned to ${selectedUserIds.length} users successfully`, { id: toastId });
            refreshRoles();
            onClose();
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to assign roles', { id: toastId });
        } finally {
            setAssigning(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>Select Role</label>
                    <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value)}
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-lite)', color: 'var(--text-main)', fontSize: '1rem' }}
                    >
                        {roles.map(role => (
                            <option key={role._id} value={role.name}>{role.name}</option>
                        ))}
                    </select>
                </div>

                <div style={{ marginBottom: '20px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>Search Users (by name or email)</label>
                    <div style={{ position: 'relative' }}>
                        <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-sub)' }} />
                        <input
                            type="text"
                            placeholder="Type to search users..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            style={{ width: '100%', padding: '12px 12px 12px 40px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-lite)', color: 'var(--text-main)', fontSize: '1rem' }}
                        />
                    </div>
                </div>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: '20px' }}>
                        <Loader2 className="animate-spin" color="var(--primary-color)" size={24} />
                    </div>
                ) : users.length > 0 ? (
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
                        {users.map((user, idx) => (
                            <div 
                                key={user._id} 
                                onClick={() => handleToggleUser(user._id)}
                                style={{ 
                                    padding: '12px', 
                                    display: 'flex', 
                                    alignItems: 'center', 
                                    gap: '12px',
                                    borderBottom: idx !== users.length - 1 ? '1px solid var(--border-color)' : 'none',
                                    background: selectedUserIds.includes(user._id) ? 'color-mix(in srgb, var(--primary-color) 10%, transparent)' : 'var(--bg-main)',
                                    cursor: 'pointer',
                                    transition: 'background 0.2s'
                                }}
                            >
                                <input 
                                    type="checkbox" 
                                    checked={selectedUserIds.includes(user._id)} 
                                    onChange={() => {}} // handled by parent onClick
                                    style={{ width: '18px', height: '18px', accentColor: 'var(--primary-color)' }}
                                />
                                <div>
                                    <div style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{user.name}</div>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{user.email} • Current Role: <span style={{ fontWeight: '600' }}>{user.role}</span></div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : searchTerm ? (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-sub)' }}>
                        No users found matching "{searchTerm}"
                    </div>
                ) : (
                    <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-sub)' }}>
                        Start typing to search for users...
                    </div>
                )}
            </div>

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button 
                    type="button" 
                    onClick={onClose} 
                    style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-lite)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}
                >
                    Cancel
                </button>
                <button 
                    type="button" 
                    onClick={handleAssign}
                    disabled={assigning || selectedUserIds.length === 0} 
                    style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: 'white', cursor: assigning || selectedUserIds.length === 0 ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}
                >
                    {assigning ? <Loader2 className="animate-spin" size={18} /> : <UserCheck size={18} />}
                    Assign ({selectedUserIds.length})
                </button>
            </div>
        </div>
    );
};

export default AssignRoleModal;
