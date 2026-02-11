import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, MapPin,
    Filter, Search, Plus, X, Mic, CheckCircle2, Circle, Loader2
} from 'lucide-react';
import { toast } from 'react-hot-toast';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';

const Calendar = () => {
    const { user } = useAuth();
    const location = useLocation();
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [reminders, setReminders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filterSource, setFilterSource] = useState('all'); // 'all', 'buddy', 'google'
    const [searchQuery, setSearchQuery] = useState('');
    const [showEventModal, setShowEventModal] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState(null);
    const [isCreating, setIsCreating] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // New reminder state
    const [newReminder, setNewReminder] = useState({
        title: '',
        time: '09:00',
        location: '',
        description: '',
        syncToGoogle: false
    });

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Fetch reminders
    useEffect(() => {
        fetchReminders();
    }, [currentDate]);

    const fetchReminders = async () => {
        setLoading(true);
        try {
            const response = await api.get('/reminders');
            if (response.data.success) {
                setReminders(response.data.data || []);
            }
        } catch (error) {
            console.error('Error fetching reminders:', error);
            toast.error('Failed to load reminders');
        } finally {
            setLoading(false);
        }
    };

    // Handle Quick Actions from Sidebar
    useEffect(() => {
        if (location.state?.action) {
            const { action } = location.state;

            if (action === 'CREATE_REMINDER' || action === 'CREATE_MEETING') {
                setSelectedDate(new Date());
                setIsCreating(true);
                setShowEventModal(true);
                setNewReminder({
                    title: action === 'CREATE_MEETING' ? 'New Meeting' : '',
                    time: '09:00',
                    location: '',
                    description: '',
                    syncToGoogle: user?.googleRefreshToken ? true : false,
                    intent: action === 'CREATE_MEETING' ? 'meeting' : 'generic'
                });
            }
        }
    }, [location.state, user]);

    // Calendar calculations
    const getDaysInMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (date) => {
        return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    };

    const generateCalendarDays = () => {
        const daysInMonth = getDaysInMonth(currentDate);
        const firstDay = getFirstDayOfMonth(currentDate);
        const days = [];

        // Previous month's trailing days
        const prevMonthDays = getDaysInMonth(
            new Date(currentDate.getFullYear(), currentDate.getMonth() - 1)
        );
        for (let i = firstDay - 1; i >= 0; i--) {
            days.push({
                day: prevMonthDays - i,
                isCurrentMonth: false,
                isPrevMonth: true,
                date: new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, prevMonthDays - i)
            });
        }

        // Current month days
        for (let day = 1; day <= daysInMonth; day++) {
            days.push({
                day,
                isCurrentMonth: true,
                isPrevMonth: false,
                date: new Date(currentDate.getFullYear(), currentDate.getMonth(), day)
            });
        }

        // Next month's leading days - ONLY fill until the end of the last row of the current month
        const totalDaysFixed = days.length;
        const remainingDays = (7 - (totalDaysFixed % 7)) % 7;
        for (let day = 1; day <= remainingDays; day++) {
            days.push({
                day,
                isCurrentMonth: false,
                isPrevMonth: false,
                date: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, day)
            });
        }

        return days;
    };

    const getRemindersForDate = (date) => {
        return reminders.filter(reminder => {
            const reminderDate = new Date(reminder.date);
            return (
                reminderDate.getDate() === date.getDate() &&
                reminderDate.getMonth() === date.getMonth() &&
                reminderDate.getFullYear() === date.getFullYear() &&
                (filterSource === 'all' ||
                    (filterSource === 'buddy' && reminder.source === 'buddy') ||
                    (filterSource === 'google' && reminder.source === 'google'))
            );
        });
    };

    const isToday = (date) => {
        const today = new Date();
        return (
            date.getDate() === today.getDate() &&
            date.getMonth() === today.getMonth() &&
            date.getFullYear() === today.getFullYear()
        );
    };

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
    };

    const handleToday = () => {
        setCurrentDate(new Date());
    };

    const handleDateClick = (date) => {
        setSelectedDate(date);
    };

    const handleEventDrop = async (reminderId, targetDate) => {
        try {
            const dateStr = targetDate.toISOString().split('T')[0];
            const response = await api.put(`/voice/${reminderId}`, { date: dateStr });
            if (response.data.success) {
                toast.success('Reminder rescheduled');
                fetchReminders();
                // Update selected date view if we move something to it
                setSelectedDate(targetDate);
            }
        } catch (error) {
            toast.error('Failed to reschedule');
        }
    };

    const handleAddClick = (date) => {
        setSelectedDate(date || new Date());
        setIsCreating(true);
        setShowEventModal(true);
        setNewReminder({
            title: '',
            time: '09:00',
            location: '',
            description: '',
            syncToGoogle: user?.googleRefreshToken ? true : false
        });
    };

    const handleEventClick = (event) => {
        setSelectedEvent(event);
        setIsCreating(false);
        setIsEditing(false);
        setShowEventModal(true);
    };

    const handleEditClick = (event) => {
        setSelectedEvent(event);
        setIsCreating(false);
        setIsEditing(true);
        setNewReminder({
            title: event.title,
            time: event.time || '09:00',
            location: event.location || '',
            description: event.description || '',
            syncToGoogle: false // Google events usually handled separately
        });
        setShowEventModal(true);
    };

    const handleUpdateReminder = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const response = await api.put(`/reminders/${selectedEvent._id}`, {
                ...newReminder,
                date: selectedEvent.date
            });
            if (response.data.success) {
                toast.success('Reminder updated!');
                setShowEventModal(false);
                fetchReminders();
            }
        } catch (error) {
            toast.error('Failed to update reminder');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateReminder = async (e) => {
        e.preventDefault();
        setLoading(true);
        try {
            const payload = {
                ...newReminder,
                date: selectedDate
            };

            const response = await api.post('/reminders', payload);
            if (response.data.success) {
                toast.success('Reminder created!');
                setShowEventModal(false);
                fetchReminders();
            }
        } catch (error) {
            toast.error(error.response?.data?.message || 'Failed to create reminder');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteReminder = async (id) => {
        if (!window.confirm('Are you sure you want to delete this reminder?')) return;

        try {
            await api.delete(`/reminders/${id}`);
            toast.success('Reminder deleted');
            setShowEventModal(false);
            fetchReminders();
        } catch (error) {
            toast.error('Failed to delete reminder');
        }
    };

    const calendarDays = generateCalendarDays();
    const filteredReminders = selectedDate ? getRemindersForDate(selectedDate) : [];

    return (
        <div className="calendar-page">
            {/* Header */}
            <div className="calendar-header">
                <div className="header-actions">
                    <button className="btn btn-primary" onClick={() => handleAddClick()}>
                        <Plus size={18} />
                        Add Reminder
                    </button>
                    <button className="btn btn-secondary" onClick={handleToday}>
                        Today
                    </button>
                    <div className="month-nav">
                        <button className="nav-btn" onClick={handlePrevMonth}>
                            <ChevronLeft size={20} />
                        </button>
                        <span className="current-month">
                            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                        </span>
                        <button className="nav-btn" onClick={handleNextMonth}>
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="calendar-filters">
                <div className="filter-group">
                    <button
                        className={`filter-btn ${filterSource === 'all' ? 'active' : ''}`}
                        onClick={() => setFilterSource('all')}
                    >
                        All Events
                    </button>
                    <button
                        className={`filter-btn ${filterSource === 'buddy' ? 'active' : ''}`}
                        onClick={() => setFilterSource('buddy')}
                    >
                        <Mic size={16} />
                        Buddy AI
                    </button>
                    {user?.googleRefreshToken && (
                        <button
                            className={`filter-btn ${filterSource === 'google' ? 'active' : ''}`}
                            onClick={() => setFilterSource('google')}
                        >
                            <CalendarIcon size={16} />
                            Google Calendar
                        </button>
                    )}
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="calendar-container">
                <div className="calendar-grid">
                    {/* Day Headers */}
                    {dayNames.map(day => (
                        <div key={day} className="day-header">
                            {day}
                        </div>
                    ))}

                    {/* Calendar Days */}
                    {loading ? (
                        <div className="loading-state">
                            <Loader2 className="animate-spin" size={32} />
                            <p>Loading calendar...</p>
                        </div>
                    ) : (
                        calendarDays.map((dayObj, index) => {
                            const dayReminders = getRemindersForDate(dayObj.date);
                            const isSelected = selectedDate &&
                                dayObj.date.toDateString() === selectedDate.toDateString();

                            return (
                                <motion.div
                                    key={index}
                                    className={`calendar-day ${!dayObj.isCurrentMonth ? 'other-month' : ''} ${isToday(dayObj.date) ? 'today' : ''
                                        } ${isSelected ? 'selected' : ''}`}
                                    onClick={() => dayObj.isCurrentMonth && handleDateClick(dayObj.date)}
                                    style={{
                                        cursor: dayObj.isCurrentMonth ? 'pointer' : 'default',
                                        pointerEvents: dayObj.isCurrentMonth ? 'auto' : 'none'
                                    }}
                                    whileHover={dayObj.isCurrentMonth ? { scale: 1.02 } : {}}
                                    whileTap={dayObj.isCurrentMonth ? { scale: 0.98 } : {}}
                                    data-date={dayObj.date.toISOString()}
                                    onMouseUpCapture={(e) => {
                                        if (window.draggingReminderId && dayObj.isCurrentMonth) {
                                            handleEventDrop(window.draggingReminderId, dayObj.date);
                                            window.draggingReminderId = null;
                                        }
                                    }}
                                >
                                    {dayObj.isCurrentMonth && (
                                        <>
                                            <span className="day-number">{dayObj.day}</span>
                                            {dayReminders.length > 0 && (
                                                <div className="event-indicators">
                                                    {dayReminders.slice(0, 3).map((reminder, i) => (
                                                        <div
                                                            key={i}
                                                            className="event-dot"
                                                            style={{
                                                                background: reminder.source === 'google'
                                                                    ? '#4285F4'
                                                                    : 'var(--primary-color)'
                                                            }}
                                                        />
                                                    ))}
                                                    {dayReminders.length > 3 && (
                                                        <span className="more-events">+{dayReminders.length - 3}</span>
                                                    )}
                                                </div>
                                            )}
                                        </>
                                    )}
                                </motion.div>
                            );
                        })
                    )}
                </div>

                {/* Selected Date Events */}
                {selectedDate && (
                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="events-sidebar"
                    >
                        <div className="sidebar-header">
                            <h3>
                                {selectedDate.toLocaleDateString('en-US', {
                                    weekday: 'long',
                                    month: 'long',
                                    day: 'numeric'
                                })}
                            </h3>
                            <button className="close-btn" onClick={() => setSelectedDate(null)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="events-list">
                            {filteredReminders.length === 0 ? (
                                <div className="empty-state">
                                    <CalendarIcon size={48} />
                                    <p>No events for this day</p>
                                </div>
                            ) : (
                                filteredReminders.map((reminder, index) => (
                                    <motion.div
                                        key={reminder._id}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: index * 0.05 }}
                                        className="event-card draggable"
                                        onClick={() => handleEventClick(reminder)}
                                        drag
                                        dragSnapToOrigin
                                        onDragStart={() => {
                                            window.draggingReminderId = reminder._id;
                                        }}
                                        onDragEnd={() => {
                                            // Delay to allow drop target to catch MouseUp
                                            setTimeout(() => {
                                                window.draggingReminderId = null;
                                            }, 100);
                                        }}
                                        whileDrag={{
                                            scale: 1.05,
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.5)',
                                            zIndex: 1000
                                        }}
                                    >
                                        <div
                                            className="event-indicator"
                                            style={{
                                                background: reminder.source === 'google'
                                                    ? '#4285F4'
                                                    : 'var(--primary-color)'
                                            }}
                                        />
                                        <div className="event-content">
                                            <h4>{reminder.title}</h4>
                                            <div className="event-meta">
                                                <Clock size={14} />
                                                <span>{reminder.time || 'All Day'}</span>
                                            </div>
                                            {reminder.location && (
                                                <div className="event-meta">
                                                    <MapPin size={14} />
                                                    <span>{reminder.location}</span>
                                                </div>
                                            )}
                                        </div>
                                        {reminder.completed ? (
                                            <CheckCircle2 size={20} className="status-icon completed" />
                                        ) : (
                                            <Circle size={20} className="status-icon" />
                                        )}
                                    </motion.div>
                                ))
                            )}
                        </div>
                    </motion.div>
                )}
            </div>

            {/* Event/Create Modal */}
            <AnimatePresence>
                {showEventModal && (
                    <div className="modal-overlay" onClick={() => setShowEventModal(false)}>
                        <motion.div
                            className="modal-content"
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={e => e.stopPropagation()}
                        >
                            <div className="modal-header">
                                <h2>{isCreating ? 'Create Reminder' : isEditing ? 'Edit Reminder' : 'Reminder Details'}</h2>
                                <button className="close-btn" onClick={() => setShowEventModal(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            {isCreating || isEditing ? (
                                <form onSubmit={isCreating ? handleCreateReminder : handleUpdateReminder} className="reminder-form">
                                    <div className="form-group">
                                        <label>Title</label>
                                        <input
                                            type="text"
                                            placeholder="What needs to be done?"
                                            value={newReminder.title}
                                            onChange={e => setNewReminder({ ...newReminder, title: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div className="form-row">
                                        <div className="form-group">
                                            <label>Time</label>
                                            <input
                                                type="time"
                                                value={newReminder.time}
                                                onChange={e => setNewReminder({ ...newReminder, time: e.target.value })}
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label>Location</label>
                                            <input
                                                type="text"
                                                placeholder="Where?"
                                                value={newReminder.location}
                                                onChange={e => setNewReminder({ ...newReminder, location: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="form-group">
                                        <label>Description</label>
                                        <textarea
                                            placeholder="Add some details..."
                                            value={newReminder.description}
                                            onChange={e => setNewReminder({ ...newReminder, description: e.target.value })}
                                        />
                                    </div>
                                    {user?.googleRefreshToken && (
                                        <div className="form-checkbox">
                                            <input
                                                type="checkbox"
                                                id="sync"
                                                checked={newReminder.syncToGoogle}
                                                onChange={e => setNewReminder({ ...newReminder, syncToGoogle: e.target.checked })}
                                            />
                                            <label htmlFor="sync">Sync to Google Calendar</label>
                                        </div>
                                    )}
                                    <button type="submit" className="btn btn-primary full-width" disabled={loading}>
                                        {loading ? <Loader2 className="animate-spin" size={20} /> : isCreating ? 'Create Reminder' : 'Save Changes'}
                                    </button>
                                </form>
                            ) : (
                                <div className="event-details">
                                    <div className="detail-item">
                                        <h3 className="detail-title">{selectedEvent?.title}</h3>
                                        <span className={`source-badge ${selectedEvent?.source}`}>
                                            {selectedEvent?.source === 'google' ? 'Google Calendar' : 'Buddy AI'}
                                        </span>
                                    </div>

                                    <div className="detail-row">
                                        <div className="detail-meta">
                                            <CalendarIcon size={18} />
                                            <span>{new Date(selectedEvent?.date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="detail-meta">
                                            <Clock size={18} />
                                            <span>{selectedEvent?.time || 'All Day'}</span>
                                        </div>
                                    </div>

                                    {selectedEvent?.location && (
                                        <div className="detail-meta">
                                            <MapPin size={18} />
                                            <span>{selectedEvent.location}</span>
                                        </div>
                                    )}

                                    {selectedEvent?.description && (
                                        <div className="detail-description">
                                            <p>{selectedEvent.description}</p>
                                        </div>
                                    )}

                                    <div className="modal-actions horizontal">
                                        <button
                                            className="btn btn-secondary flex-1"
                                            onClick={() => handleEditClick(selectedEvent)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-danger flex-1"
                                            onClick={() => handleDeleteReminder(selectedEvent?._id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            )}
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

            <style>{`
                .calendar-day.drag-over {
                    background: rgba(var(--primary-rgb), 0.2) !important;
                    border-color: var(--primary-color) !important;
                    transform: scale(1.02);
                }
                
                .event-card.draggable {
                    cursor: grab;
                }
                
                .event-card.draggable:active {
                    cursor: grabbing;
                }

                .calendar-page {
                    padding: 0;
                    color: var(--text-main);
                }

                .calendar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                    flex-wrap: wrap;
                    gap: 1.5rem;
                }

                .header-left {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .icon-badge {
                    width: 48px;
                    height: 48px;
                    background: var(--primary-color);
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    color: white;
                    box-shadow: 0 4px 15px rgba(var(--primary-rgb), 0.3);
                }

                .page-title {
                    font-size: 1.75rem;
                    font-weight: 800;
                    margin: 0;
                    color: var(--text-main);
                }

                .page-subtitle {
                    font-size: 0.9rem;
                    color: var(--text-sub);
                    margin: 4px 0 0 0;
                }

                .header-actions {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .month-nav {
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    background: var(--card-bg);
                    padding: 8px 12px;
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                }

                .nav-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-main);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    display: flex;
                    align-items: center;
                    transition: all 0.2s;
                }

                .nav-btn:hover {
                    background: var(--bg-lite);
                }

                .btn-primary {
                    background: var(--primary-color);
                    color: white;
                    border: none;
                    padding: 10px 20px;
                    border-radius: 12px;
                    font-weight: 600;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-primary:hover {
                    opacity: 0.9;
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(var(--primary-rgb), 0.3);
                }

                .btn-danger {
                    background: #ff4d4d;
                    color: white;
                    border: none;
                    padding: 12px 24px;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    width: 100%;
                    transition: all 0.2s;
                }

                .btn-danger:hover {
                    background: #ff3333;
                }

                .full-width {
                    width: 100%;
                    justify-content: center;
                }

                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: rgba(0, 0, 0, 0.7);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 1000;
                }

                .modal-content {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    width: 100%;
                    max-width: 500px;
                    border-radius: 20px;
                    padding: 2rem;
                    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
                }

                .modal-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 2rem;
                }

                .modal-header h2 {
                    font-size: 1.25rem;
                    margin: 0;
                    color: var(--text-main);
                }

                .reminder-form {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .form-row {
                    display: grid;
                    grid-template-columns: 120px 1fr;
                    gap: 1rem;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 0.5rem;
                }

                .form-group label {
                    font-size: 0.85rem;
                    font-weight: 600;
                    color: var(--text-sub);
                }

                .form-group input, .form-group textarea {
                    background: var(--bg-lite);
                    border: 1px solid var(--border-color);
                    padding: 12px;
                    border-radius: 10px;
                    color: var(--text-main);
                    outline: none;
                }

                .form-group input:focus, .form-group textarea:focus {
                    border-color: var(--primary-color);
                }

                .form-group textarea {
                    min-height: 100px;
                    resize: none;
                }

                .form-checkbox {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 0.9rem;
                    color: var(--text-main);
                    cursor: pointer;
                }

                .event-details {
                    display: flex;
                    flex-direction: column;
                    gap: 1.5rem;
                }

                .detail-title {
                    font-size: 1.5rem;
                    margin: 0 0 0.5rem 0;
                    color: var(--text-main);
                }

                .source-badge {
                    display: inline-block;
                    padding: 4px 10px;
                    border-radius: 20px;
                    font-size: 0.75rem;
                    font-weight: 700;
                    text-transform: uppercase;
                }

                .source-badge.google {
                    background: rgba(66, 133, 244, 0.2);
                    color: #4285F4;
                }

                .source-badge.buddy {
                    background: rgba(139, 92, 246, 0.2);
                    color: var(--primary-color);
                }

                .detail-row {
                    display: flex;
                    gap: 2rem;
                }

                .detail-meta {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    color: var(--text-sub);
                    font-size: 0.95rem;
                }

                .detail-description {
                    padding: 1rem;
                    background: var(--bg-lite);
                    border-radius: 10px;
                    color: var(--text-main);
                    font-size: 0.95rem;
                    line-height: 1.5;
                }

                .modal-actions {
                    margin-top: 1rem;
                    padding-top: 1.5rem;
                    border-top: 1px solid var(--border-color);
                }

                .modal-actions.horizontal {
                    display: flex;
                    gap: 1rem;
                }

                .flex-1 {
                    flex: 1;
                }

                .btn-secondary {
                    background: var(--bg-lite);
                    border: 1px solid var(--border-color);
                    color: var(--text-main);
                    padding: 12px;
                    border-radius: 12px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-secondary:hover {
                    background: var(--border-color);
                }

                .current-month {
                    font-size: 0.95rem;
                    font-weight: 700;
                    min-width: 180px;
                    text-align: center;
                    color: var(--text-main);
                }

                .calendar-filters {
                    margin-bottom: 1.5rem;
                }

                .filter-group {
                    display: flex;
                    gap: 0.75rem;
                    flex-wrap: wrap;
                }

                .filter-btn {
                    padding: 10px 20px;
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    color: var(--text-sub);
                    font-weight: 600;
                    font-size: 0.85rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.2s;
                }

                .filter-btn:hover {
                    background: var(--bg-lite);
                    border-color: var(--primary-color);
                }

                .filter-btn.active {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }

                .calendar-container {
                    display: grid;
                    grid-template-columns: 1fr 320px;
                    gap: 2rem;
                }

                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px;
                    background: var(--border-color);
                    border-radius: 16px;
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                }

                .day-header {
                    background: var(--card-bg);
                    padding: 12px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 0.75rem;
                    color: var(--text-sub);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .calendar-day {
                    background: var(--card-bg);
                    min-height: 100px;
                    padding: 12px;
                    cursor: pointer;
                    position: relative;
                    transition: all 0.2s;
                    display: flex;
                    flex-direction: column;
                }

                .calendar-day:hover {
                    background: var(--bg-lite);
                }

                .calendar-day.other-month {
                    opacity: 0.4;
                }

                .calendar-day.today {
                    background: rgba(var(--primary-rgb), 0.1);
                }

                .calendar-day.today .day-number {
                    background: var(--primary-color);
                    color: white;
                }

                .calendar-day.selected {
                    background: rgba(var(--primary-rgb), 0.15);
                    border: 2px solid var(--primary-color);
                }

                .day-number {
                    font-size: 0.9rem;
                    font-weight: 700;
                    color: var(--text-main);
                    width: 28px;
                    height: 28px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border-radius: 50%;
                }

                .event-indicators {
                    display: flex;
                    gap: 4px;
                    margin-top: auto;
                    flex-wrap: wrap;
                }

                .event-dot {
                    width: 6px;
                    height: 6px;
                    border-radius: 50%;
                }

                .more-events {
                    font-size: 0.7rem;
                    color: var(--text-sub);
                    font-weight: 600;
                }

                .events-sidebar {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: 16px;
                    padding: 1.5rem;
                    height: fit-content;
                    max-height: 600px;
                    overflow-y: auto;
                }

                .sidebar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 1.5rem;
                    padding-bottom: 1rem;
                    border-bottom: 1px solid var(--border-color);
                }

                .sidebar-header h3 {
                    font-size: 1rem;
                    font-weight: 700;
                    margin: 0;
                    color: var(--text-main);
                }

                .close-btn {
                    background: transparent;
                    border: none;
                    color: var(--text-sub);
                    cursor: pointer;
                    padding: 4px;
                    border-radius: 6px;
                    display: flex;
                    transition: all 0.2s;
                }

                .close-btn:hover {
                    background: var(--bg-lite);
                    color: var(--text-main);
                }

                .events-list {
                    display: flex;
                    flex-direction: column;
                    gap: 0.75rem;
                }

                .event-card {
                    background: var(--bg-lite);
                    border: 1px solid var(--border-color);
                    border-radius: 12px;
                    padding: 12px;
                    cursor: pointer;
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                    transition: all 0.2s;
                }

                .event-card:hover {
                    background: var(--bg-color);
                    border-color: var(--primary-color);
                }

                .event-indicator {
                    width: 4px;
                    height: 100%;
                    border-radius: 2px;
                    flex-shrink: 0;
                }

                .event-content {
                    flex: 1;
                }

                .event-content h4 {
                    font-size: 0.9rem;
                    font-weight: 600;
                    margin: 0 0 6px 0;
                    color: var(--text-main);
                }

                .event-meta {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    color: var(--text-sub);
                    margin-top: 4px;
                }

                .status-icon {
                    color: var(--text-sub);
                    flex-shrink: 0;
                }

                .status-icon.completed {
                    color: var(--success-color);
                }

                .empty-state {
                    text-align: center;
                    padding: 3rem 1rem;
                    color: var(--text-sub);
                }

                .empty-state svg {
                    opacity: 0.3;
                    margin-bottom: 1rem;
                }

                .loading-state {
                    grid-column: 1 / -1;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: 4rem;
                    color: var(--text-sub);
                    gap: 1rem;
                }

                .animate-spin {
                    animation: spin 1s linear infinite;
                }

                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }

                @media (max-width: 1024px) {
                    .calendar-container {
                        grid-template-columns: 1fr;
                    }

                    .events-sidebar {
                        max-height: 400px;
                    }
                }

                @media (max-width: 768px) {
                    .calendar-header {
                        flex-direction: column;
                        align-items: flex-start;
                    }

                    .header-actions {
                        width: 100%;
                        flex-direction: column;
                    }

                    .month-nav {
                        width: 100%;
                        justify-content: space-between;
                    }

                    .calendar-day {
                        min-height: 80px;
                        padding: 8px;
                    }

                    .day-header {
                        font-size: 0.65rem;
                        padding: 8px;
                    }
                }
            `}</style>
        </div>
    );
};

export default Calendar;
