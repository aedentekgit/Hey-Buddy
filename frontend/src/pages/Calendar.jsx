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
import { formatTime } from '../utils/dateUtils';

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
                    (filterSource === 'google' && (reminder.source === 'google' || !!reminder.googleEventId)))
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
            <div className="calendar-header">
                <div className="calendar-controls-row">
                    <div className="header-actions">
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

                    <div className="calendar-filters">
                        <div className="filter-group">
                            <button
                                className={`filter-btn ${filterSource === 'all' ? 'active' : ''}`}
                                onClick={() => setFilterSource('all')}
                            >
                                <Filter size={16} />
                                <span className="hide-mobile-text">All Events</span>
                            </button>
                            <button
                                className={`filter-btn ${filterSource === 'buddy' ? 'active' : ''}`}
                                onClick={() => setFilterSource('buddy')}
                            >
                                <Mic size={16} />
                                <span className="hide-mobile-text">Buddy AI</span>
                            </button>
                            {user?.googleRefreshToken && (
                                <button
                                    className={`filter-btn ${filterSource === 'google' ? 'active' : ''}`}
                                    onClick={() => setFilterSource('google')}
                                >
                                    <CalendarIcon size={16} />
                                    <span className="hide-mobile-text">Google Calendar</span>
                                </button>
                            )}
                        </div>
                    </div>
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
                                                                background: (reminder.source === 'google' || !!reminder.googleEventId)
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
                                                background: (reminder.source === 'google' || !!reminder.googleEventId)
                                                    ? '#4285F4'
                                                    : 'var(--primary-color)'
                                            }}
                                        />
                                        <div className="event-content">
                                            <h4>{reminder.title}</h4>
                                            <div className="event-meta">
                                                <Clock size={14} />
                                                <span>{formatTime(reminder.time)}</span>
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
                                        <span className={`source-badge ${(selectedEvent?.source === 'google' || !!selectedEvent?.googleEventId) ? 'google' : 'buddy'}`}>
                                            {(selectedEvent?.source === 'google' || !!selectedEvent?.googleEventId) ? 'Google Calendar' : 'Buddy AI'}
                                        </span>
                                    </div>

                                    <div className="detail-row">
                                        <div className="detail-meta">
                                            <CalendarIcon size={18} />
                                            <span>{new Date(selectedEvent?.date).toLocaleDateString()}</span>
                                        </div>
                                        <div className="detail-meta">
                                            <Clock size={18} />
                                            <span>{formatTime(selectedEvent?.time)}</span>
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
                @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&display=swap');

                .calendar-page {
                    font-family: 'Plus Jakarta Sans', sans-serif;
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
                    padding: 6px 10px;
                    border-radius: var(--radius-md);
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
                    transition: all 0.1s;
                }

                .nav-btn:hover {
                    background: var(--row-hover);
                }

                .calendar-controls-row {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    width: 100%;
                }

                .filter-group {
                    display: flex;
                    gap: 0.5rem;
                }

                .filter-btn {
                    padding: 8px 16px;
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    color: var(--text-sub);
                    font-weight: 600;
                    font-size: 0.85rem;
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.1s;
                }

                .filter-btn:hover {
                    background: var(--row-hover);
                }

                .filter-btn.active {
                    background: var(--primary-color);
                    color: white;
                    border-color: var(--primary-color);
                }

                .calendar-container {
                    display: grid;
                    grid-template-columns: 1fr 340px;
                    gap: 24px;
                }

                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 1px;
                    background: var(--border-color);
                    border-radius: var(--radius-lg);
                    overflow: hidden;
                    border: 1px solid var(--border-color);
                    box-shadow: var(--card-shadow);
                }

                .day-header {
                    background: var(--th-bg);
                    padding: 12px;
                    text-align: center;
                    font-weight: 700;
                    font-size: 0.7rem;
                    color: var(--th-text);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    border-bottom: 1px solid var(--border-color);
                }

                .calendar-day {
                    background: var(--card-bg);
                    min-height: 120px;
                    padding: 12px;
                    cursor: pointer;
                    position: relative;
                    transition: background 0.1s;
                    display: flex;
                    flex-direction: column;
                }

                .calendar-day:hover {
                    background: var(--row-hover);
                }

                .calendar-day.today {
                    background: color-mix(in srgb, var(--primary-color) 5%, var(--card-bg));
                }

                .calendar-day.selected {
                    box-shadow: inset 0 0 0 2px var(--primary-color);
                    z-index: 10;
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

                .calendar-day.today .day-number {
                    background: var(--primary-color);
                    color: white;
                }

                .events-sidebar {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-lg);
                    padding: 24px;
                    height: fit-content;
                    max-height: 800px;
                    overflow-y: auto;
                    box-shadow: var(--card-shadow);
                }

                .sidebar-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                    padding-bottom: 12px;
                    border-bottom: 1px solid var(--border-color);
                }

                .sidebar-header h3 {
                    font-size: 0.95rem;
                    font-weight: 700;
                    margin: 0;
                }

                .event-card {
                    background: var(--bg-lite);
                    border: 1px solid var(--border-color);
                    border-radius: var(--radius-md);
                    padding: 12px;
                    cursor: grab;
                    display: flex;
                    gap: 12px;
                    align-items: flex-start;
                    transition: all 0.1s;
                    margin-bottom: 8px;
                }

                .event-card:hover {
                    border-color: var(--primary-color);
                    background: var(--card-bg);
                }

                .event-indicator {
                    width: 3px;
                    height: 38px;
                    border-radius: 4px;
                    flex-shrink: 0;
                }

                .event-content h4 {
                    font-size: 0.875rem;
                    font-weight: 600;
                    margin: 0 0 4px 0;
                }

                .event-meta {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    font-size: 0.75rem;
                    color: var(--text-sub);
                }

                .modal-overlay {
                    position: fixed;
                    inset: 0;
                    background: rgba(0, 0, 0, 0.4);
                    backdrop-filter: blur(4px);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 2000;
                }

                .modal-content {
                    background: var(--card-bg);
                    border: 1px solid var(--border-color);
                    width: 100%;
                    max-width: 480px;
                    border-radius: var(--radius-lg);
                    padding: 32px;
                    box-shadow: var(--card-shadow);
                }

                .form-group label {
                    font-size: 0.72rem;
                    font-weight: 700;
                    color: var(--text-sub);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                    margin-bottom: 8px;
                }

                .form-group input, .form-group textarea {
                    background: var(--bg-lite);
                    border: 1px solid var(--border-color);
                    padding: 12px 14px;
                    border-radius: var(--radius-md);
                    color: var(--text-main);
                    font-size: 0.85rem;
                    font-weight: 500;
                    transition: all 0.2s ease;
                }

                .form-group input:focus, .form-group textarea:focus {
                    border-color: var(--primary-color);
                    background: var(--card-bg);
                    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 8%, transparent);
                    outline: none;
                }

                .source-badge {
                    padding: 4px 10px;
                    border-radius: 6px;
                    font-size: 0.65rem;
                    font-weight: 800;
                    text-transform: uppercase;
                    letter-spacing: 0.04em;
                    border: 1px solid transparent;
                }

                .source-badge.google { 
                    background: color-mix(in srgb, #4338CA 8%, transparent); 
                    color: #4338CA;
                    border-color: color-mix(in srgb, #4338CA 20%, transparent);
                }
                .source-badge.buddy { 
                    background: color-mix(in srgb, var(--primary-color) 8%, transparent); 
                    color: var(--primary-color);
                    border-color: color-mix(in srgb, var(--primary-color) 20%, transparent);
                }

                @media (max-width: 1024px) {
                    .calendar-container { grid-template-columns: 1fr; }
                }

                @media (max-width: 768px) {
                    /* --- Premium App Header Layout --- */
                    .calendar-header {
                        margin-bottom: 24px;
                    }

                    .calendar-controls-row {
                        flex-direction: column;
                        gap: 16px;
                    }

                    /* Row 1: Navigation & Actions combined */
                    /* Row 1: Navigation Only */
                    .header-actions {
                        display: flex;
                        justify-content: center;
                        align-items: center;
                        width: 100%;
                    }

                    /* Month Nav (Center) */
                    .month-nav {
                        background: transparent;
                        border: none;
                        padding: 0;
                        justify-content: space-between;
                        gap: 16px;
                        width: 100%;
                        max-width: 300px;
                    }

                    .current-month {
                        font-size: 1.1rem;
                        font-weight: 800;
                        color: var(--text-main);
                        order: 2; /* Text in middle */
                    }

                    .month-nav .nav-btn {
                        background: var(--bg-lite);
                        color: var(--text-main);
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        justify-content: center;
                        border: 1px solid var(--border-color);
                    }
                    
                    .month-nav .nav-btn:first-child { order: 1; } /* Left Arrow */
                    .month-nav .nav-btn:last-child { order: 3; } /* Right Arrow */

                    /* Filter Row (Row 2) */
                    .calendar-filters {
                        width: 100%;
                        overflow-x: auto;
                        padding-bottom: 4px; /* Scrollbar space */
                        -webkit-overflow-scrolling: touch;
                    }
                    
                    .filter-group {
                        display: flex;
                        justify-content: flex-start; /* Align left */
                        gap: 8px;
                    }

                    .filter-btn {
                        flex-shrink: 0;
                        padding: 8px 16px;
                        border-radius: 20px;
                        background: var(--bg-lite);
                        border: 1px solid var(--border-color);
                        font-size: 0.75rem;
                        height: 36px;
                    }
                    
                    .filter-btn svg { width: 14px; height: 14px; }
                    .filter-btn.active {
                        background: var(--primary-color);
                        color: white;
                        border: none;
                    }

                    .hide-mobile-text { display: none; }

                    /* --- Seamless Grid Layout --- */
                    .calendar-container {
                        gap: 0;
                    }

                    .calendar-grid {
                        background: transparent;
                        border: none;
                        box-shadow: none;
                        gap: 0; /* Remove gap for seamless look */
                    }

                    .day-header {
                        background: transparent;
                        border: none;
                        color: var(--text-sub);
                        font-size: 0.75rem;
                        opacity: 0.7;
                        padding-bottom: 8px;
                    }

                    .calendar-day {
                        min-height: 56px; /* Taller touch targets */
                        aspect-ratio: auto;
                        border: none; /* No borders */
                        background: transparent !important; /* Transparent bg */
                        border-radius: 0;
                        padding: 4px;
                        align-items: center;
                        justify-content: flex-start;
                        position: relative;
                    }
                    
                    /* Selection Circle */
                    .day-number {
                        width: 32px;
                        height: 32px;
                        font-size: 0.9rem;
                        font-weight: 600;
                        margin-bottom: 4px;
                        border-radius: 12px; /* Soft square */
                        transition: all 0.2s ease;
                        z-index: 2;
                    }

                    /* Today State */
                    .calendar-day.today .day-number {
                        background: var(--primary-color);
                        color: white;
                        box-shadow: 0 2px 8px color-mix(in srgb, var(--primary-color) 40%, transparent);
                    }

                    /* Selected State */
                    .calendar-day.selected .day-number {
                        background: white;
                        color: black;
                        font-weight: 800;
                    }

                    /* Event Dots */
                    .event-indicators {
                        position: absolute;
                        bottom: 8px;
                        left: 0;
                        right: 0;
                        display: flex;
                        justify-content: center;
                        gap: 3px;
                    }

                    .event-dot {
                        width: 5px;
                        height: 5px;
                        border-radius: 50%;
                    }
                    
                    .more-events { display: none; }

                    .other-month { opacity: 0.3; }

                    /* --- Events Bottom Sheet --- */
                    .events-sidebar {
                        position: fixed;
                        bottom: 0;
                        left: 0;
                        right: 0;
                        border-radius: 24px 24px 0 0;
                        border: 1px solid var(--border-color);
                        border-bottom: none;
                        background: var(--card-bg); /* Use theme variable */
                        backdrop-filter: blur(20px);
                        -webkit-backdrop-filter: blur(20px);
                        z-index: 1005;
                        padding: 24px;
                        padding-bottom: 100px;
                        box-shadow: 0 -10px 40px rgba(0,0,0,0.15); /* Softer shadow */
                        max-height: 70vh;
                        animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
                        color: var(--text-main);
                    }

                    .sidebar-header {
                        position: sticky;
                        top: 0;
                        margin-bottom: 20px;
                        padding-bottom: 0;
                        border: none;
                        background: transparent;
                        justify-content: space-between;
                        align-items: center;
                        display: flex;
                    }

                    .sidebar-header h3 {
                        font-size: 1.1rem;
                        font-weight: 800;
                        color: var(--text-main);
                        margin: 0;
                        width: 100%;
                        text-align: center;
                    }
                    
                    .sidebar-header .close-btn {
                        position: absolute;
                        right: 0;
                        top: 50%;
                        transform: translateY(-50%);
                        background: var(--bg-lite);
                        width: 32px;
                        height: 32px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: var(--text-sub);
                        border: 1px solid var(--border-color);
                        z-index: 20;
                    }

                    .sidebar-header::before {
                        content: '';
                        position: absolute;
                        top: -12px;
                        left: 50%;
                        transform: translateX(-50%);
                        width: 48px;
                        height: 5px;
                        background: var(--border-color);
                        border-radius: 10px;
                        opacity: 0.5;
                    }
                    
                    /* List Container */
                    .events-list {
                        display: flex;
                        flex-direction: column;
                        gap: 12px;
                    }

                    /* Event Card Professional Style */
                    .event-card {
                        background: var(--bg-lite);
                        border: 1px solid var(--border-color);
                        border-radius: 16px;
                        padding: 16px;
                        display: flex;
                        align-items: center;
                        gap: 16px;
                        box-shadow: 0 2px 8px rgba(0,0,0,0.02);
                        transition: transform 0.2s ease, box-shadow 0.2s ease;
                    }
                    
                    .event-card:active {
                        transform: scale(0.98);
                    }

                    .event-indicator {
                        width: 4px;
                        height: 40px;
                        border-radius: 4px;
                        flex-shrink: 0;
                    }
                    
                    .event-content {
                        flex: 1;
                        display: flex;
                        flex-direction: column;
                        gap: 4px;
                    }

                    .event-content h4 {
                        font-size: 1rem;
                        font-weight: 700;
                        color: var(--text-main);
                        margin: 0;
                    }

                    .event-meta {
                        display: flex;
                        align-items: center;
                        gap: 6px;
                        font-size: 0.8rem;
                        color: var(--text-sub);
                        font-weight: 500;
                    }
                    
                    .event-meta svg {
                        width: 14px;
                        height: 14px;
                    }

                    .status-icon {
                        color: var(--text-sub);
                        opacity: 0.5;
                    }
                    
                    .empty-state {
                        text-align: center;
                        padding: 40px 20px;
                        color: var(--text-sub);
                        display: flex;
                        flex-direction: column;
                        align-items: center;
                        gap: 12px;
                    }
                    
                    .empty-state svg {
                        width: 48px;
                        height: 48px;
                        opacity: 0.3;
                    }
                }
            `}</style>
        </div>
    );
};

export default Calendar;
