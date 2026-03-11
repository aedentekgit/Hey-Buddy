import React, { useState, useEffect } from 'react';
import {
    MapPin, Bell, AlertTriangle, Users, Plus, Trash2,
    ChevronRight, Loader2, Calendar, Clock, X, Save
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import locationReminderService from '../services/locationReminderService';
import ConfirmationModal from '../components/ConfirmationModal';

const LocationReminders = () => {
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [isAdding, setIsAdding] = useState(false);
    const [deleteModal, setDeleteModal] = useState({ isOpen: false, id: null });
    const [formData, setFormData] = useState({
        title: '',
        location: '',
        date: new Date().toISOString().split('T')[0],
        time: '10:00 AM',
        warningLevel: 'medium'
    });

    useEffect(() => {
        fetchReminders();
    }, []);

    const fetchReminders = async () => {
        try {
            setLoading(true);
            const res = await locationReminderService.getAll();
            if (res.success) {
                setReminders(res.data);
            }
        } catch (err) {
            console.error(err);
            toast.error("Failed to load location reminders");
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async (e) => {
        e.preventDefault();
        try {
            const res = await locationReminderService.create(formData);
            if (res.success) {
                toast.success("Location reminder created");
                setIsAdding(false);
                setFormData({
                    title: '',
                    location: '',
                    date: new Date().toISOString().split('T')[0],
                    time: '10:00 AM',
                    warningLevel: 'medium'
                });
                fetchReminders();
            }
        } catch (err) {
            toast.error("Failed to create reminder");
        }
    };

    const handleDelete = async () => {
        try {
            const res = await locationReminderService.delete(deleteModal.id);
            if (res.success) {
                toast.success("Reminder deleted");
                setReminders(prev => prev.filter(r => r._id !== deleteModal.id));
                setDeleteModal({ isOpen: false, id: null });
            }
        } catch (err) {
            toast.error("Failed to delete reminder");
        }
    };

    const handleFamilyBackup = async (id) => {
        try {
            const res = await locationReminderService.setFamilyBackup(id);
            if (res.success) {
                toast.success("Family Backup activated");
                fetchReminders();
            }
        } catch (err) {
            toast.error("Action failed");
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto min-h-screen">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Location Reminders</h1>
                    <p className="text-slate-500 mt-1">Smart geofenced reminders for your safety</p>
                </div>
                <button
                    onClick={() => setIsAdding(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-emerald-200 active:scale-95"
                >
                    <Plus size={20} />
                    <span>New Reminder</span>
                </button>
            </div>

            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="animate-spin text-emerald-600" size={40} />
                </div>
            ) : reminders.length === 0 ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-slate-100 shadow-sm">
                    <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MapPin size={40} className="text-slate-300" />
                    </div>
                    <h3 className="text-xl font-bold text-slate-800">No Location Reminders</h3>
                    <p className="text-slate-500 mt-2 mb-6">Create your first geofenced reminder to get started</p>
                    <button
                        onClick={() => setIsAdding(true)}
                        className="text-emerald-600 font-bold hover:underline"
                    >
                        + Create First Reminder
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    <AnimatePresence>
                        {reminders.map((reminder) => (
                            <motion.div
                                key={reminder._id}
                                layout
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className={`group relative bg-white rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl transition-all overflow-hidden`}
                            >
                                {/* Status Header */}
                                <div className={`h-1.5 w-full ${reminder.status === 'risk_alert' ? 'bg-rose-500' : 'bg-emerald-500'}`} />

                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${reminder.status === 'risk_alert' ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                                            <Bell size={24} className={reminder.status === 'risk_alert' ? 'text-rose-600' : 'text-emerald-600'} />
                                        </div>
                                        <button
                                            onClick={() => setDeleteModal({ isOpen: true, id: reminder._id })}
                                            className="p-2 text-slate-300 hover:text-rose-500 transition-colors"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    </div>

                                    <h3 className="text-lg font-bold text-slate-800 mb-1 group-hover:text-emerald-700 transition-colors">{reminder.title}</h3>
                                    <div className="flex items-center gap-2 mb-4">
                                        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md ${reminder.status === 'risk_alert' ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                                            }`}>
                                            {reminder.status?.replace('_', ' ')}
                                        </span>
                                    </div>

                                    <div className="space-y-3 mt-4">
                                        <div className="flex items-center gap-3 text-slate-600 text-sm">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                <Calendar size={14} />
                                            </div>
                                            <span>{reminder.date} • {reminder.time}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-slate-600 text-sm">
                                            <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center">
                                                <MapPin size={14} />
                                            </div>
                                            <span className="truncate">{reminder.location}</span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-3 mt-8">
                                        <button className="flex items-center justify-center gap-2 bg-amber-50 hover:bg-amber-100 text-amber-700 py-2.5 rounded-xl text-xs font-bold transition-colors">
                                            <AlertTriangle size={14} />
                                            Early Warning
                                        </button>
                                        <button
                                            onClick={() => handleFamilyBackup(reminder._id)}
                                            className="flex items-center justify-center gap-2 bg-blue-50 hover:bg-blue-100 text-blue-700 py-2.5 rounded-xl text-xs font-bold transition-colors"
                                        >
                                            <Users size={14} />
                                            Family Backup
                                        </button>
                                    </div>
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            )}

            {/* Create Overlay */}
            <AnimatePresence>
                {isAdding && (
                    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl"
                        >
                            <div className="p-8">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-2xl font-black text-slate-800">New Reminder</h2>
                                    <button onClick={() => setIsAdding(false)} className="p-2 hover:bg-slate-100 rounded-full">
                                        <X size={20} />
                                    </button>
                                </div>

                                <form onSubmit={handleCreate} className="space-y-5">
                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 tracking-widest mb-2 uppercase">Reminder Title</label>
                                        <input
                                            required
                                            className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                                            placeholder="e.g. Visit Tower Bridge"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 tracking-widest mb-2 uppercase">Location</label>
                                        <div className="relative">
                                            <MapPin size={18} className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" />
                                            <input
                                                required
                                                className="w-full bg-slate-50 border-none rounded-2xl pl-12 pr-5 py-4 text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-emerald-500 transition-all"
                                                placeholder="e.g. London, UK"
                                                value={formData.location}
                                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 tracking-widest mb-2 uppercase">Date</label>
                                            <input
                                                type="date"
                                                required
                                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-800 focus:ring-2 focus:ring-emerald-500 transition-all"
                                                value={formData.date}
                                                onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-black text-slate-400 tracking-widest mb-2 uppercase">Time</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-slate-800 focus:ring-2 focus:ring-emerald-500 transition-all"
                                                placeholder="10:00 AM"
                                                value={formData.time}
                                                onChange={(e) => setFormData({ ...formData, time: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-[10px] font-black text-slate-400 tracking-widest mb-2 uppercase">Warning Level</label>
                                        <div className="grid grid-cols-3 gap-2">
                                            {['low', 'medium', 'high'].map(level => (
                                                <button
                                                    key={level}
                                                    type="button"
                                                    onClick={() => setFormData({ ...formData, warningLevel: level })}
                                                    className={`py-2.5 rounded-xl text-xs font-bold capitalize transition-all border ${formData.warningLevel === level
                                                            ? 'bg-emerald-50 border-emerald-500 text-emerald-700 shadow-sm'
                                                            : 'bg-white border-slate-100 text-slate-400'
                                                        }`}
                                                >
                                                    {level}
                                                </button>
                                            ))}
                                        </div>
                                    </div>

                                    <button
                                        type="submit"
                                        className="w-full bg-slate-900 hover:bg-black text-white py-4 rounded-2xl font-black mt-4 transition-all active:scale-95 shadow-lg"
                                    >
                                        Create Reminder
                                    </button>
                                </form>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <ConfirmationModal
                isOpen={deleteModal.isOpen}
                onClose={() => setDeleteModal({ isOpen: false, id: null })}
                onConfirm={handleDelete}
                title="Delete Reminder"
                message="Are you sure you want to delete this location reminder?"
                confirmText="Delete"
                variant="danger"
            />
        </div>
    );
};

export default LocationReminders;
