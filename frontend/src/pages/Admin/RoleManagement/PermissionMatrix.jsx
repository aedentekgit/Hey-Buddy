
const MODULES = [
    {
        id: 'dashboard',
        label: 'Dashboard Overview',
        actions: ['view'],
    },
    {
        id: 'users',
        label: 'Users Management',
        actions: ['view', 'create', 'update', 'delete'],
        granular: [
            { id: 'ban_users', label: 'Ban Users' },
            { id: 'assign_roles', label: 'Assign Roles' }
        ]
    },
    {
        id: 'roles',
        label: 'Role Management',
        actions: ['view', 'create', 'update', 'delete']
    },
    {
        id: 'courses',
        label: 'Courses',
        actions: ['view', 'create', 'update', 'delete']
    },
    {
        id: 'live_sessions',
        label: 'Live Sessions',
        actions: ['view', 'create', 'update', 'delete']
    },
    {
        id: 'transactions',
        label: 'Transactions',
        actions: ['view', 'create', 'delete'],
        granular: [
            { id: 'view_revenue', label: 'View Revenue' }
        ]
    },
    {
        id: 'certificates',
        label: 'Certificates',
        actions: ['view', 'create', 'update', 'delete'],
        granular: [
            { id: 'approve_certificates', label: 'Approve Certificates' }
        ]
    },
    {
        id: 'buddy',
        label: 'Buddy AI',
        actions: ['view']
    },
    {
        id: 'automations',
        label: 'Automations',
        actions: ['view', 'create', 'update', 'delete']
    }
];

const PermissionMatrix = ({ permissions, onChange }) => {
    
    const handleToggleAction = (moduleId, action) => {
        const permKey = `${moduleId}_${action}`;
        if (permissions.includes(permKey)) {
            onChange(permissions.filter(p => p !== permKey));
        } else {
            onChange([...permissions, permKey]);
        }
    };

    const handleToggleAllModule = (moduleId, actions, granular) => {
        const allKeys = [...actions.map(a => `${moduleId}_${a}`), ...(granular ? granular.map(g => `${moduleId}_${g.id}`) : [])];
        const hasAll = allKeys.every(k => permissions.includes(k));

        if (hasAll) {
            onChange(permissions.filter(p => !allKeys.includes(p)));
        } else {
            const newPerms = new Set([...permissions, ...allKeys]);
            onChange(Array.from(newPerms));
        }
    };

    return (
        <div style={{ width: '100%', overflowX: 'auto', background: 'var(--bg-main)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '600px' }}>
                <thead>
                    <tr style={{ background: 'var(--bg-lite)', borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Module</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'center' }}>View</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'center' }}>Create</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'center' }}>Update</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold', textAlign: 'center' }}>Delete</th>
                        <th style={{ padding: '12px 16px', fontWeight: 'bold' }}>Granular</th>
                    </tr>
                </thead>
                <tbody>
                    {MODULES.map((mod) => {
                        const allActionKeys = [...mod.actions.map(a => `${mod.id}_${a}`), ...(mod.granular ? mod.granular.map(g => `${mod.id}_${g.id}`) : [])];
                        const isAllSelected = allActionKeys.every(k => permissions.includes(k));

                        return (
                            <tr key={mod.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                                <td style={{ padding: '12px 16px', fontWeight: '600', color: 'var(--text-main)', borderRight: '1px solid var(--border-color)' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <input
                                            type="checkbox"
                                            checked={isAllSelected}
                                            onChange={() => handleToggleAllModule(mod.id, mod.actions, mod.granular)}
                                            style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                                            title={`Toggle all ${mod.label} permissions`}
                                        />
                                        {mod.label}
                                    </div>
                                </td>
                                {['view', 'create', 'update', 'delete'].map(action => (
                                    <td key={action} style={{ padding: '12px', textAlign: 'center' }}>
                                        {mod.actions.includes(action) ? (
                                            <input
                                                type="checkbox"
                                                checked={permissions.includes(`${mod.id}_${action}`)}
                                                onChange={() => handleToggleAction(mod.id, action)}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--primary-color)' }}
                                            />
                                        ) : (
                                            <span style={{ color: 'var(--text-sub)', fontSize: '0.8rem' }}>-</span>
                                        )}
                                    </td>
                                ))}
                                <td style={{ padding: '12px 16px', fontSize: '0.85rem' }}>
                                    {mod.granular?.map(gran => (
                                        <div key={gran.id} style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                                            <input
                                                type="checkbox"
                                                checked={permissions.includes(`${mod.id}_${gran.id}`)}
                                                onChange={() => handleToggleAction(mod.id, gran.id)}
                                                style={{ cursor: 'pointer', accentColor: 'var(--info-color)' }}
                                            />
                                            <label style={{ cursor: 'pointer', color: 'var(--text-main)' }} onClick={() => handleToggleAction(mod.id, gran.id)}>
                                                {gran.label}
                                            </label>
                                        </div>
                                    ))}
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
};

export default PermissionMatrix;
