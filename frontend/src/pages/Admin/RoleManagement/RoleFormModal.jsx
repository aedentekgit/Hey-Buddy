import { useState, useEffect } from 'react';
import api from '../../../services/api';
import { toast } from 'react-hot-toast';
import { Save, Globe, Smartphone, ShieldCheck } from 'lucide-react';
import PermissionMatrix from './PermissionMatrix';

const RoleFormModal = ({ role, onClose, refresh }) => {
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        status: 'active',
        permissions: [],
        webAccess: true,
        mobileAccess: true,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (role) {
            setFormData({
                name: role.name || '',
                description: role.description || '',
                status: role.status || 'active',
                permissions: role.permissions || [],
                webAccess: role.webAccess !== undefined ? role.webAccess : true,
                mobileAccess: role.mobileAccess !== undefined ? role.mobileAccess : true,
            });
        }
    }, [role]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const toastId = toast.loading(role ? 'Updating role...' : 'Creating role...');

        try {
            if (role) {
                const res = await api.put(`/roles/${role._id}`, formData);
                if (res.data.success) {
                    toast.success('Role updated successfully', { id: toastId });
                    refresh();
                    onClose();
                }
            } else {
                const res = await api.post('/roles', formData);
                if (res.data.success) {
                    toast.success('Role created successfully', { id: toastId });
                    refresh();
                    onClose();
                }
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Operation failed', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: '8px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>Role Name</label>
                        <input
                            type="text"
                            required
                            disabled={role?.isSystem}
                            value={formData.name}
                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                            placeholder="e.g., Content Editor"
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-lite)', color: 'var(--text-main)', fontSize: '1rem' }}
                        />
                        {role?.isSystem && <span style={{ color: '#eab308', fontSize: '0.8rem', marginTop: '4px', display: 'block' }}>System role name cannot be changed</span>}
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>Status</label>
                        <select
                            value={formData.status}
                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                            style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-lite)', color: 'var(--text-main)', fontSize: '1rem' }}
                        >
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '8px', fontWeight: 'bold', color: 'var(--text-main)' }}>Description (Context of role)</label>
                    <textarea
                        rows="2"
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        placeholder="Briefly describe what this role entails..."
                        style={{ width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-lite)', color: 'var(--text-main)', fontSize: '1rem', resize: 'vertical' }}
                    />
                </div>

                <div className="form-group" style={{ marginBottom: '24px' }}>
                    <label style={{ display: 'block', marginBottom: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>Platform Access Control</label>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        {/* Web Access */}
                        <div
                            onClick={() => setFormData({ ...formData, webAccess: !formData.webAccess })}
                            style={{
                                padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                                background: formData.webAccess ? 'color-mix(in srgb, var(--success-color) 10%, transparent)' : 'var(--bg-lite)',
                                border: `1px solid ${formData.webAccess ? 'var(--success-color)' : 'var(--border-color)'}`,
                                display: 'flex', flexDirection: 'column', gap: '8px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Globe size={24} color={formData.webAccess ? 'var(--success-color)' : 'var(--text-sub)'} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 'bold', color: formData.webAccess ? 'var(--success-color)' : 'var(--text-main)' }}>Web Access</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{formData.webAccess ? 'Enabled' : 'Restricted'}</div>
                            </div>
                        </div>

                        {/* Mobile Access */}
                        <div
                            onClick={() => setFormData({ ...formData, mobileAccess: !formData.mobileAccess })}
                            style={{
                                padding: '16px', borderRadius: '12px', cursor: 'pointer', transition: 'all 0.2s',
                                background: formData.mobileAccess ? 'color-mix(in srgb, var(--info-color) 10%, transparent)' : 'var(--bg-lite)',
                                border: `1px solid ${formData.mobileAccess ? 'var(--info-color)' : 'var(--border-color)'}`,
                                display: 'flex', flexDirection: 'column', gap: '8px'
                            }}
                        >
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <Smartphone size={24} color={formData.mobileAccess ? 'var(--info-color)' : 'var(--text-sub)'} />
                            </div>
                            <div>
                                <div style={{ fontWeight: 'bold', color: formData.mobileAccess ? 'var(--info-color)' : 'var(--text-main)' }}>Mobile App Access</div>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>{formData.mobileAccess ? 'Enabled' : 'Restricted'}</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="form-group">
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontWeight: 'bold', color: 'var(--text-main)' }}>
                        <ShieldCheck size={20} color="var(--primary-color)" />
                        Granular Permission Matrix
                    </label>
                    <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                        <PermissionMatrix 
                            permissions={formData.permissions} 
                            onChange={(newPerms) => setFormData({ ...formData, permissions: newPerms })} 
                        />
                    </div>
                </div>
            </div>

            <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '12px' }}>
                <button type="button" onClick={onClose} style={{ padding: '12px 24px', borderRadius: '8px', border: '1px solid var(--border-color)', background: 'var(--bg-lite)', color: 'var(--text-main)', cursor: 'pointer', fontWeight: 'bold' }}>
                    Cancel
                </button>
                <button type="submit" disabled={loading} style={{ padding: '12px 24px', borderRadius: '8px', border: 'none', background: 'var(--primary-color)', color: 'white', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Save size={18} />
                    {role ? 'Update Role' : 'Create Role'}
                </button>
            </div>
        </form>
    );
};

export default RoleFormModal;
