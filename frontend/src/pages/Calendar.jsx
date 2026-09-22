import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CheckCheck,
  ChevronRight,
  ClipboardList,
  Globe2,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import { axiosInstance } from '../lib/axios'
import { fetchBoardsWithCache } from '../lib/boardsCache'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'

const CalendarPage = () => {
  const navigate = useNavigate()
  const hoverTimerRef = useRef(null)
  const touchStartYRef = useRef(0)
  const sheetPointerActiveRef = useRef(false)
  const [boards, setBoards] = useState([])
  const [tasks, setTasks] = useState([])
  const [search] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [selectedDay, setSelectedDay] = useState(null)
  const [isClosing, setIsClosing] = useState(false)
  const [sheetDragOffset, setSheetDragOffset] = useState(0)
  const [hoveredTask, setHoveredTask] = useState(null)
  const closeSheetTimeoutRef = useRef(null)
  const [isDesktopHover, setIsDesktopHover] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(hover: hover) and (pointer: fine)').matches
  })
  const [isMobileView, setIsMobileView] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.matchMedia('(max-width: 767px)').matches
  })
  const [cursorMonth, setCursorMonth] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), 1)
  })
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  } = useWorkspaceNavigation()

  useEffect(() => {
    let isCurrent = true
    Promise.all([
      fetchBoardsWithCache(),
      axiosInstance.get('/board/my-tasks'),
    ])
      .then(([nextBoards, tasksResponse]) => {
        if (!isCurrent) return
        setBoards(nextBoards)
        setTasks(tasksResponse.data.filter((task) => task.dueDate))
      })
      .catch((error) => {
        if (isCurrent) toast.error(error.response?.data?.message || 'Could not load calendar')
      })
      .finally(() => {
        if (isCurrent) setIsLoading(false)
      })
    return () => {
      isCurrent = false
    }
  }, [])

  const today = useMemo(() => new Date(), [])
  const todayKey = new Date(today.getFullYear(), today.getMonth(), today.getDate()).toISOString().slice(0, 10)
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(cursorMonth)

  const toDateKey = (date) => {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const formatDayLabel = (date) =>
    new Intl.DateTimeFormat(undefined, {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    }).format(date)

  const isSameDay = (left, right) => {
    if (!left || !right) return false
    return toDateKey(left) === toDateKey(right)
  }

  const selectedDayKey = selectedDay ? toDateKey(selectedDay) : null

  const handleCloseSheet = useCallback(() => {
    if (!selectedDay || isClosing) return

    setIsClosing(true)
    setSheetDragOffset(0)
    if (closeSheetTimeoutRef.current) {
      clearTimeout(closeSheetTimeoutRef.current)
    }

    closeSheetTimeoutRef.current = setTimeout(() => {
      setSelectedDay(null)
      setIsClosing(false)
      setSheetDragOffset(0)
      closeSheetTimeoutRef.current = null
    }, 300)
  }, [isClosing, selectedDay])

  useEffect(() => {
    const hoverQuery = window.matchMedia('(hover: hover) and (pointer: fine)')
    const mobileQuery = window.matchMedia('(max-width: 767px)')
    const handleHoverChange = (event) => setIsDesktopHover(event.matches)
    const handleMobileChange = (event) => setIsMobileView(event.matches)

    if (typeof hoverQuery.addEventListener === 'function') {
      hoverQuery.addEventListener('change', handleHoverChange)
    } else {
      hoverQuery.addListener(handleHoverChange)
    }

    if (typeof mobileQuery.addEventListener === 'function') {
      mobileQuery.addEventListener('change', handleMobileChange)
      return () => {
        hoverQuery.removeEventListener('change', handleHoverChange)
        mobileQuery.removeEventListener('change', handleMobileChange)
      }
    }

    mobileQuery.addListener(handleMobileChange)
    return () => {
      hoverQuery.removeListener(handleHoverChange)
      mobileQuery.removeListener(handleMobileChange)
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && selectedDay) {
        handleCloseSheet()
        setHoveredTask(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleCloseSheet, selectedDay])

  useEffect(() => {
    document.body.style.overflow = selectedDay || isClosing ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [selectedDay, isClosing])

  useEffect(() => () => {
    if (closeSheetTimeoutRef.current) {
      clearTimeout(closeSheetTimeoutRef.current)
    }
  }, [])

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return tasks
    return tasks.filter((task) => {
      const boardName = task.column?.board?.name || ''
      const columnName = task.column?.title || ''
      return [task.title, boardName, columnName].some((value) =>
        String(value || '').toLowerCase().includes(query),
      )
    })
  }, [search, tasks])

  const days = useMemo(() => {
    const month = cursorMonth.getFullYear()
    const monthNumber = cursorMonth.getMonth()
    const monthStart = new Date(month, monthNumber, 1)
    const monthEnd = new Date(month, monthNumber + 1, 0)

    const gridStart = new Date(monthStart)
    gridStart.setDate(monthStart.getDate() - monthStart.getDay())

    const gridEnd = new Date(monthEnd)
    gridEnd.setDate(monthEnd.getDate() + (6 - monthEnd.getDay()))

    const grid = []
    const cursor = new Date(gridStart)

    while (cursor <= gridEnd) {
      const dateValue = new Date(cursor)
      const isCurrentMonth = dateValue.getMonth() === monthNumber && dateValue.getFullYear() === month
      const isToday = dateValue.toDateString() === today.toDateString()
      const isPrevMonth = !isCurrentMonth && dateValue < monthStart
      const isNextMonth = !isCurrentMonth && dateValue > monthEnd

      grid.push({
        date: dateValue,
        isCurrentMonth,
        isToday,
        isPrevMonth,
        isNextMonth,
      })
      cursor.setDate(cursor.getDate() + 1)
    }

    return grid
  }, [cursorMonth, today])

  const totalWeeks = Math.ceil(days.length / 7)
  const calendarSkeletonDays = Array.from({ length: 35 }, (_, index) => index)

  const tasksByDate = useMemo(() => {
    const grouped = new Map()
    filteredTasks.forEach((task) => {
      const dateKey = String(task.dueDate).slice(0, 10)
      const current = grouped.get(dateKey) || []
      grouped.set(dateKey, [...current, task])
    })
    return grouped
  }, [filteredTasks])

  const todayTasks = useMemo(
    () => filteredTasks.filter((task) => String(task.dueDate).slice(0, 10) === todayKey),
    [filteredTasks, todayKey],
  )
  const upcomingTasks = useMemo(
    () => filteredTasks.filter((task) => String(task.dueDate).slice(0, 10) > todayKey),
    [filteredTasks, todayKey],
  )
  const overdueTasks = useMemo(
    () => filteredTasks.filter((task) => String(task.dueDate).slice(0, 10) < todayKey),
    [filteredTasks, todayKey],
  )

  const moveMonth = (amount) => {
    setCursorMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  const goToday = () => setCursorMonth(new Date(today.getFullYear(), today.getMonth(), 1))

  const getTaskState = (dateKey) => {
    if (dateKey < todayKey) return 'overdue'
    if (dateKey === todayKey) return 'today'
    return 'upcoming'
  }

  const getTaskAssignee = (task) => {
    if (!task) return null
    if (task.assignee && typeof task.assignee === 'object') {
      return task.assignee.name || task.assignee.email || 'Assigned'
    }
    if (task.assigneeName) return task.assigneeName
    if (task.assignee) return task.assignee
    if (task.owner && typeof task.owner === 'object') {
      return task.owner.name || task.owner.email || 'Assigned'
    }
    return null
  }

  const getTaskPriority = (task) => {
    if (!task) return null
    const value = task.priority || task.priorityLevel || task.severity
    if (!value) return null
    return String(value).charAt(0).toUpperCase() + String(value).slice(1)
  }

  const getTaskColor = (task, dateKey) => {
    if (task?.color) return task.color
    const state = getTaskState(dateKey)
    if (state === 'overdue') return '#ef4444'
    if (state === 'today') return '#f59e0b'
    return '#10b981'
  }

  const selectedDayTasks = useMemo(() => {
    if (!selectedDayKey) return []
    return (tasksByDate.get(selectedDayKey) || []).slice().sort((a, b) => {
      const left = a.dueDate ? new Date(a.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      const right = b.dueDate ? new Date(b.dueDate).getTime() : Number.MAX_SAFE_INTEGER
      return left - right
    })
  }, [selectedDayKey, tasksByDate])

  const mobileOverviewCards = useMemo(() => [
    {
      title: 'Workspace Pulse',
      text: `${boards.length} active spaces and ${filteredTasks.length} tasks currently tracked across the workspace`,
      meta: 'Updated live',
      accent: 'before:bg-blue-500',
      icon: Globe2,
      action: () => navigate('/workspaces'),
    },
    {
      title: 'Review Queue',
      text: `${overdueTasks.length} items still need attention before the next review cycle`,
      meta: 'Open requests',
      accent: 'before:bg-amber-500',
      icon: CheckCheck,
      action: () => navigate('/my-tasks'),
    },
    {
      title: 'Upcoming Milestones',
      text: `${upcomingTasks.length} planned deliverables are already scheduled for this period`,
      meta: 'Full timeline',
      accent: 'before:bg-emerald-500',
      icon: ClipboardList,
      action: () => navigate('/calendar'),
    },
  ], [boards.length, filteredTasks.length, navigate, overdueTasks.length, upcomingTasks.length])

  const showTaskPreview = (task, event) => {
    if (!task || !event || !isDesktopHover || isMobileView) return
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)

    hoverTimerRef.current = setTimeout(() => {
      const previewWidth = 288
      const previewHeight = 180
      const collisionPadding = 16
      const x = event.clientX + 12
      const y = event.clientY - 12
      const left = Math.min(
        Math.max(x, collisionPadding),
        window.innerWidth - previewWidth - collisionPadding,
      )
      const top = Math.min(
        Math.max(y - previewHeight / 2, collisionPadding),
        window.innerHeight - previewHeight - collisionPadding,
      )

      setHoveredTask({
        task,
        x: left,
        y: top,
      })
    }, 120)
  }

  const hideTaskPreview = () => {
    if (hoverTimerRef.current) clearTimeout(hoverTimerRef.current)
    setHoveredTask(null)
  }

  const handleSheetTouchEnd = () => {
    if (sheetDragOffset > 100) {
      handleCloseSheet()
      return
    }

    setSheetDragOffset(0)
    touchStartYRef.current = 0
  }

  const handleSheetPointerDown = (event) => {
    sheetPointerActiveRef.current = true
    touchStartYRef.current = event.clientY
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handleSheetPointerMove = (event) => {
    if (!sheetPointerActiveRef.current) return
    event.preventDefault()
    const delta = Math.max(0, event.clientY - touchStartYRef.current)
    setSheetDragOffset(delta)
  }

  const handleSheetPointerUp = () => {
    if (!sheetPointerActiveRef.current) return
    sheetPointerActiveRef.current = false
    handleSheetTouchEnd()
  }

  return (
    <div className='workspace-shell h-dvh max-h-dvh flex flex-col overflow-hidden md:flex-row'>
      <WorkspaceSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        boards={boards}
        selectedBoardId={null}
        onBoardSelect={(board) => navigate(`/workspaces/${board._id}`)}
        onCreateBoard={() => navigate('/workspaces')}
        isCollapsed={isSidebarCollapsed}
      />
      <main className='workspace-main flex-1 min-h-0 flex flex-col overflow-hidden'>
        <WorkspaceTopbar
          isSidebarOpen={isSidebarOpen}
          onSidebarToggle={() => setIsSidebarOpen((value) => !value)}
          isSidebarCollapsed={isSidebarCollapsed}
          onSidebarCollapse={() => setIsSidebarCollapsed((value) => !value)}
        >
          <div className='workspace-context-copy'>
            <div className='workspace-context-label'>Workspace</div>
            <div className='workspace-board-title-row'>
              <span className='workspace-board-name'>
                <ChevronRight size={13} /> Calendar
              </span>
            </div>
          </div>
        </WorkspaceTopbar>

        <section className='calendar-page workspace-content my-tasks-page flex-1 min-h-0 flex flex-col overflow-hidden'>
          <header className='calendar-page-header shrink-0'>
            <div className='calendar-title-wrap' />
          </header>

          <div className='calendar-overview'>
            <div className='calendar-stat-card today-stat'>
              <span>Due today</span>
              <strong>{todayTasks.length}</strong>
              <small>{todayTasks.length === 1 ? 'task on schedule' : 'tasks on schedule'}</small>
            </div>
            <div className='calendar-stat-card'>
              <span>Upcoming</span>
              <strong>{upcomingTasks.length}</strong>
              <small>{upcomingTasks.length === 1 ? 'task ahead' : 'tasks ahead'}</small>
            </div>
            <div className='calendar-stat-card overdue-stat'>
              <span>Overdue</span>
              <strong>{overdueTasks.length}</strong>
              <small>{overdueTasks.length === 1 ? 'needs attention' : 'need attention'}</small>
            </div>
          </div>

          {isMobileView ? (
            isLoading ? (
              <div className='md:hidden min-h-dvh h-auto flex flex-col p-3 space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none'>
                <div className='calendar-skeleton-shell w-full shrink-0 rounded-3xl bg-white p-4 shadow-sm flex flex-col'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='calendar-skeleton-line h-6 w-32 rounded-full' />
                    <div className='calendar-skeleton-pill h-6 w-16 rounded-full' />
                  </div>

                  <div className='mt-3 flex items-center justify-center gap-2'>
                    <div className='calendar-skeleton-button h-8 w-10 rounded-xl' />
                    <div className='calendar-skeleton-button h-8 w-16 rounded-xl' />
                    <div className='calendar-skeleton-button h-8 w-10 rounded-xl' />
                  </div>

                  <div className='mt-3 grid grid-cols-7 gap-x-1 gap-y-2 text-center'>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className='calendar-skeleton-dot h-3 w-7 mx-auto rounded-full' />
                    ))}
                  </div>

                  <div className='mt-1 grid w-full grid-cols-7 gap-x-1 gap-y-2'>
                    {calendarSkeletonDays.map((item) => (
                      <div key={item} className='calendar-skeleton-cell flex h-12 flex-col items-center justify-center gap-1 rounded-xl border border-slate-200 bg-slate-50'>
                        <div className='calendar-skeleton-dot h-5 w-5 rounded-full' />
                        <div className='calendar-skeleton-dot h-1.5 w-5 rounded-full' />
                      </div>
                    ))}
                  </div>
                </div>
                <div className='calendar-mobile-overview-skeleton'>
                  <div className='calendar-skeleton-line calendar-mobile-overview-skeleton-title' />
                  {[1, 2, 3].map((item) => (
                    <div className='calendar-mobile-overview-skeleton-card' key={item}>
                      <div className='calendar-skeleton-dot calendar-mobile-overview-skeleton-icon' />
                      <div className='calendar-mobile-overview-skeleton-copy'>
                        <div className='calendar-skeleton-line' />
                        <div className='calendar-skeleton-line' />
                        <div className='calendar-skeleton-line' />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className='md:hidden min-h-dvh h-auto flex flex-col p-3 space-y-3 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] scrollbar-none'>
                <div className='w-full shrink-0 rounded-3xl bg-white p-4 shadow-sm flex flex-col'>
                  <div className='flex items-center justify-between gap-3'>
                    <div className='text-base font-bold text-slate-900'>{monthName}</div>
                    <span className='rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-600'>
                      {filteredTasks.length} due
                    </span>
                  </div>

                  <div className='mt-3 flex items-center justify-center gap-2'>
                    <button className='calendar-arrow px-2 py-1.5' onClick={() => moveMonth(-1)} aria-label='Previous month'><ArrowLeft size={14} /></button>
                    <button className='calendar-today px-2.5 py-1.5 text-xs' onClick={goToday}>Today</button>
                    <button className='calendar-arrow px-2 py-1.5' onClick={() => moveMonth(1)} aria-label='Next month'><ArrowRight size={14} /></button>
                  </div>

                  <div className='mt-3 grid grid-cols-7 gap-x-1 gap-y-2 text-center'>
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                      <div key={day} className='text-[10px] font-semibold tracking-[0.18em] text-slate-400'>{day}</div>
                    ))}
                  </div>

                  <div className='mt-1 grid w-full grid-cols-7 gap-x-1 gap-y-2'>
                    {days.map(({ date, isCurrentMonth, isToday }) => {
                      const key = toDateKey(date)
                      const dayTasks = isCurrentMonth ? tasksByDate.get(key) || [] : []
                      const isSelected = isSameDay(date, selectedDate)

                      return (
                        <button
                          key={key}
                          type='button'
                          onClick={() => {
                            setSelectedDate(date)
                            setSelectedDay(date)
                          }}
                          className={[
                            'relative flex cursor-pointer flex-col items-center justify-center p-0.5 transition-all',
                            isCurrentMonth ? 'text-slate-800' : 'pointer-events-none text-slate-300',
                          ].filter(Boolean).join(' ')}
                        >
                          <span className={[
                            'flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-all',
                            isSelected ? 'bg-emerald-700 text-white font-bold shadow-sm' : isCurrentMonth ? 'text-slate-800' : 'text-slate-300',
                            isToday && !isSelected && isCurrentMonth ? 'font-bold text-emerald-700' : '',
                          ].filter(Boolean).join(' ')}>
                            {date.getDate()}
                          </span>

                          {isCurrentMonth && (
                            <div className='mt-1 flex min-h-1 items-center justify-center gap-0.5'>
                              {dayTasks.slice(0, 3).map((task) => (
                                <span
                                  key={task._id || `${task.title}-${key}`}
                                  className={[
                                    'h-1 w-1 shrink-0 rounded-full',
                                    isSelected ? 'bg-white/80' : '',
                                  ].filter(Boolean).join(' ')}
                                  style={{ backgroundColor: isSelected ? undefined : getTaskColor(task, key) }}
                                />
                              ))}
                              {dayTasks.length > 3 && (
                                <span className={[
                                  'h-1 w-1 shrink-0 rounded-full',
                                  isSelected ? 'bg-white/60' : 'bg-slate-300',
                                ].filter(Boolean).join(' ')} />
                              )}
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className='w-full rounded-3xl bg-white p-4 shadow-sm'>
                  <div className='mb-3 text-sm font-bold text-slate-900'>Workspace Overview</div>
                  <div className='space-y-3'>
                    {mobileOverviewCards.map(({ title, text, meta, accent, icon: Icon, action }) => (
                      <button
                        key={title}
                        type='button'
                        onClick={action}
                        className={`relative flex w-full flex-col justify-between overflow-hidden rounded-2xl border border-slate-100 bg-white p-3.5 text-left shadow-sm ${accent}`}
                      >
                        <div className='absolute inset-x-0 top-0 h-1' />
                        <div className='flex items-center justify-between gap-2'>
                          <div className='flex h-9 w-9 items-center justify-center rounded-xl bg-slate-100 text-slate-700'>
                            <Icon size={16} />
                          </div>
                          <ArrowRight size={15} className='text-slate-400' />
                        </div>

                        <div className='mt-3'>
                          <div className='text-sm font-bold text-slate-900'>{title}</div>
                          <div className='mt-1 text-[11px] leading-5 text-slate-500'>{text}</div>
                        </div>

                        <div className='mt-3 text-[10px] font-medium text-slate-400'>{meta}</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          ) : (
            isLoading ? (
              <section className='calendar-app-frame hidden w-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm md:flex md:rounded-3xl md:p-6 md:flex-1 md:min-h-0'>
                <div className='calendar-toolbar shrink-0'>
                  <div className='calendar-month-switcher'>
                    <div className='calendar-skeleton-line h-9 w-48 rounded-full' />
                    <div className='calendar-skeleton-pill h-7 w-16 rounded-full' />
                  </div>
                  <div className='calendar-top-switch'>
                    <div className='calendar-skeleton-button h-9 w-9 rounded-xl' />
                    <div className='calendar-skeleton-button h-9 w-20 rounded-xl' />
                    <div className='calendar-skeleton-button h-9 w-9 rounded-xl' />
                  </div>
                </div>

                <div className='calendar-weekdays shrink-0'>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className='calendar-skeleton-dot h-4 w-7 rounded-full mx-auto' />
                  ))}
                </div>

                <div className='calendar-days-grid grid w-full grid-cols-7 flex-1 min-h-0 gap-1 md:gap-2.5'>
                  {calendarSkeletonDays.map((item) => (
                    <div key={item} className='calendar-skeleton-cell relative flex h-full min-h-23.75 flex-col rounded-2xl border border-slate-200 bg-slate-50 p-2'>
                      <div className='mb-1.5 flex items-center justify-between'>
                        <div className='calendar-skeleton-dot h-6 w-6 rounded-full' />
                      </div>

                      <div className='mt-1 flex flex-col gap-1'>
                        <div className='calendar-skeleton-task h-6 w-full rounded-md' />
                        <div className='calendar-skeleton-task h-6 w-4/5 rounded-md' />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : (
              <section className='calendar-app-frame hidden w-full flex-col overflow-hidden rounded-3xl border border-slate-100 bg-white p-4 shadow-sm md:flex md:rounded-3xl md:p-6 md:flex-1 md:min-h-0'>
                <div className='calendar-toolbar shrink-0'>
                  <div className='calendar-month-switcher'>
                    <span className='calendar-month-name'>{monthName}</span>
                    <span className='calendar-date-pill'>{filteredTasks.length} due</span>
                  </div>
                  <div className='calendar-top-switch'>
                    <button className='calendar-arrow' onClick={() => moveMonth(-1)} aria-label='Previous month'><ArrowLeft size={16} /></button>
                    <button className='calendar-today' onClick={goToday}>Today</button>
                    <button className='calendar-arrow' onClick={() => moveMonth(1)} aria-label='Next month'><ArrowRight size={16} /></button>
                  </div>
                </div>

                <div className='calendar-weekdays shrink-0'>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                    <div key={day} className='calendar-weekday text-[10px] md:text-xs'>{day}</div>
                  ))}
                </div>

                <div
                  className='calendar-days-grid grid w-full grid-cols-7 flex-1 min-h-0 gap-1 md:gap-2.5'
                  style={{ gridTemplateRows: `repeat(${totalWeeks}, minmax(0, 1fr))` }}
                >
                  {days.map(({ date, isCurrentMonth, isToday, isPrevMonth, isNextMonth }) => {
                    const key = toDateKey(date)
                    const dayTasks = isCurrentMonth ? tasksByDate.get(key) || [] : []
                    const visibleTasks = dayTasks.slice(0, 2)
                    const hiddenTaskCount = Math.max(dayTasks.length - visibleTasks.length, 0)
                    const taskCountLabel = String(dayTasks.length)

                    return (
                      <div
                        key={key}
                        className={[
                          'calendar-day-cell',
                          'relative flex h-full min-h-23.75 flex-col rounded-2xl border p-2 transition-all duration-200',
                          isCurrentMonth ? 'border-slate-200/80 bg-white hover:border-emerald-300' : 'border-slate-100 bg-slate-50/40 opacity-40',
                          isToday && isCurrentMonth ? 'border-emerald-300 bg-emerald-50/30 shadow-[inset_0_0_0_1px_rgba(16,185,129,0.08)]' : '',
                        ].filter(Boolean).join(' ')}
                        data-prev-month={isPrevMonth ? 'true' : 'false'}
                        data-next-month={isNextMonth ? 'true' : 'false'}
                        onClick={() => {
                          if (isCurrentMonth) {
                            setSelectedDay(date)
                          }
                        }}
                      >
                        <div className='mb-1.5 flex shrink-0 items-center justify-between'>
                          <span className={[
                            'flex h-7 w-7 items-center justify-center rounded-full text-[13px] font-semibold',
                            isCurrentMonth ? 'text-slate-700' : 'text-slate-300',
                            isToday && isCurrentMonth ? 'bg-emerald-700 text-white shadow-sm' : '',
                          ].filter(Boolean).join(' ')}>
                            {date.getDate()}
                          </span>

                          {isCurrentMonth && dayTasks.length > 0 && (
                            <span className='hidden md:inline-flex rounded-full border border-slate-200 bg-white/80 px-2 py-1 text-[11px] font-semibold tracking-[0.02em] text-slate-500'>
                              {taskCountLabel}
                            </span>
                          )}
                        </div>

                        {isCurrentMonth && (
                          <div className='hidden w-full min-h-0 md:flex md:flex-col md:gap-1'>
                            {visibleTasks.map((task) => (
                              <button
                                key={task._id || `${task.title}-${key}`}
                                type='button'
                                className={[
                                  'h-6 w-full shrink-0 rounded-md border px-2 text-left text-[11px] font-medium leading-none transition-all duration-200 flex items-center gap-1.5 shadow-[0_1px_0_rgba(15,23,42,0.02)]',
                                  getTaskState(key) === 'overdue' ? 'border-rose-200/80 bg-rose-50/80 text-rose-800 hover:bg-rose-100' :
                                  getTaskState(key) === 'today' ? 'border-amber-200/80 bg-amber-50/80 text-amber-800 hover:bg-amber-100' :
                                  'border-slate-200/80 bg-slate-50 text-slate-700 hover:bg-slate-100',
                                ].join(' ')}
                                onClick={(event) => {
                                  event.stopPropagation()
                                  if (task.column?.board?._id) {
                                    navigate(`/workspaces/${task.column.board._id}`)
                                  }
                                }}
                                onMouseEnter={(event) => showTaskPreview(task, event)}
                                onMouseMove={(event) => showTaskPreview(task, event)}
                                onMouseLeave={hideTaskPreview}
                                onFocus={(event) => showTaskPreview(task, event)}
                                onBlur={hideTaskPreview}
                              >
                                <span
                                  className='h-1.5 w-1.5 shrink-0 rounded-full'
                                  style={{ backgroundColor: getTaskColor(task, key) }}
                                />
                                <span className='truncate leading-none'>{task.title}</span>
                              </button>
                            ))}

                            {hiddenTaskCount > 0 && (
                              <span className='mt-0.5 shrink-0 pl-1 text-[9px] font-semibold leading-none tracking-[0.01em] text-slate-400'>
                                +{hiddenTaskCount} more
                              </span>
                            )}
                          </div>
                        )}

                        {isCurrentMonth && (
                          <div className='mt-auto flex min-h-1 items-center justify-center gap-0.5 md:hidden'>
                            {dayTasks.slice(0, 3).map((task) => (
                              <span
                                key={task._id || `${task.title}-${key}`}
                                className='h-1 w-1 shrink-0 rounded-full'
                                style={{ backgroundColor: getTaskColor(task, key) }}
                              />
                            ))}
                            {dayTasks.length > 3 && (
                              <span className='h-1 w-1 shrink-0 rounded-full bg-slate-300' aria-hidden='true' />
                            )}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                {!isLoading && filteredTasks.length === 0 && (
                  <div className='calendar-empty-state'>
                    <CalendarDays size={20} />
                    <strong>{search ? 'No matching tasks' : 'No scheduled tasks'}</strong>
                    <span>{search ? 'Try another search.' : 'Tasks with due dates will appear here.'}</span>
                  </div>
                )}
              </section>
            )
          )}

          {!isMobileView && selectedDay && (
            <div className='calendar-day-modal-backdrop' onClick={handleCloseSheet}>
              <div className='calendar-day-modal' role='dialog' aria-modal='true' onClick={(event) => event.stopPropagation()}>
                <div className='calendar-modal-header'>
                  <div>
                    <span className='calendar-modal-eyebrow'>Tasks</span>
                    <h3>{formatDayLabel(selectedDay)}</h3>
                  </div>
                  <button
                    type='button'
                    className='calendar-modal-close'
                    aria-label='Close day tasks'
                    onClick={handleCloseSheet}
                  >
                    ×
                  </button>
                </div>

                <div className='calendar-modal-body'>
                  {selectedDayTasks.length > 0 ? (
                    selectedDayTasks.map((task) => {
                      const taskKey = task._id || `${task.title}-${task.dueDate}`
                      const dueLabel = task.dueDate
                        ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(task.dueDate))
                        : 'No due date'

                      return (
                        <button
                          key={taskKey}
                          type='button'
                          className='calendar-modal-task'
                          onClick={() => {
                            if (task.column?.board?._id) {
                              navigate(`/workspaces/${task.column.board._id}`)
                              setSelectedDay(null)
                            }
                          }}
                        >
                          <span className={`calendar-modal-task-status is-${getTaskState(toDateKey(new Date(task.dueDate || selectedDay)))}`} />
                          <div className='calendar-modal-task-copy'>
                            <span className='calendar-modal-task-title'>{task.title}</span>
                            <span className='calendar-modal-task-meta'>
                              {task.column?.board?.name || 'Workspace'} · {dueLabel}
                            </span>
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className='calendar-modal-empty'>No tasks scheduled for this day.</div>
                  )}
                </div>

              </div>
            </div>
          )}

          {selectedDay && isMobileView && (
            <div
              className={`calendar-mobile-sheet-backdrop bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${isClosing ? 'opacity-0' : 'opacity-100'}`}
              onClick={handleCloseSheet}
            >
              <div
                className='calendar-mobile-sheet fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl bg-white shadow-2xl overflow-hidden'
                style={{
                  transform: `translateY(${isClosing ? '100%' : `${sheetDragOffset}px`})`,
                  transition: isClosing ? 'transform 300ms ease-in-out' : sheetDragOffset === 0 ? 'transform 220ms ease-out' : 'none',
                }}
                role='dialog'
                aria-modal='true'
                onClick={(event) => event.stopPropagation()}
              >
                <div
                  className='calendar-mobile-sheet-handle'
                  onPointerDown={handleSheetPointerDown}
                  onPointerMove={handleSheetPointerMove}
                  onPointerUp={handleSheetPointerUp}
                  onPointerCancel={handleSheetPointerUp}
                  role='presentation'
                />
                <div className='calendar-mobile-sheet-header'>
                  <div>
                    <div className='calendar-mobile-sheet-label'>Tasks</div>
                    <h3>{formatDayLabel(selectedDay)}</h3>
                  </div>
                </div>

                <div className='calendar-mobile-sheet-body'>
                  {selectedDayTasks.length > 0 ? (
                    selectedDayTasks.map((task) => {
                      const taskKey = task._id || `${task.title}-${task.dueDate}`
                      const dueLabel = task.dueDate
                        ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(task.dueDate))
                        : 'No due date'

                      return (
                        <button
                          key={taskKey}
                          type='button'
                          className='calendar-mobile-sheet-item'
                          onClick={() => {
                            if (task.column?.board?._id) {
                              navigate(`/workspaces/${task.column.board._id}`)
                              handleCloseSheet()
                            }
                          }}
                        >
                          <div className='calendar-mobile-sheet-item-top'>
                            <span className={`calendar-mobile-sheet-status is-${getTaskState(toDateKey(new Date(task.dueDate || selectedDay)))}`} />
                            <span className='calendar-mobile-sheet-title'>{task.title}</span>
                          </div>

                          <div className='calendar-mobile-sheet-meta'>
                            <span>{task.column?.title || task.status || 'Task'}</span>
                            <span>{dueLabel}</span>
                          </div>
                        </button>
                      )
                    })
                  ) : (
                    <div className='calendar-mobile-sheet-empty'>No tasks scheduled for this day.</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {hoveredTask && createPortal(
            <div
              className='calendar-task-preview w-72'
              style={{
                position: 'fixed',
                left: `${hoveredTask.x}px`,
                top: `${hoveredTask.y}px`,
                zIndex: 9999,
              }}
            >
              <div className='calendar-task-preview-header'>
                <span className={`calendar-task-preview-status is-${getTaskState(toDateKey(new Date(hoveredTask.task.dueDate || new Date())))}`} />
                <span className='calendar-task-preview-column'>
                  {hoveredTask.task.column?.title || hoveredTask.task.status || 'Task'}
                </span>
              </div>

              <div className='calendar-task-preview-title'>{hoveredTask.task.title}</div>

              {hoveredTask.task.description && (
                <p className='calendar-task-preview-description'>
                  {hoveredTask.task.description}
                </p>
              )}

              <div className='calendar-task-preview-meta'>
                {(hoveredTask.task.column?.title || hoveredTask.task.status) && (
                  <span className='calendar-task-preview-badge'>
                    <span className={`calendar-task-preview-badge-dot is-${getTaskState(toDateKey(new Date(hoveredTask.task.dueDate || new Date())))}`} />
                    {hoveredTask.task.column?.title || hoveredTask.task.status || 'Task'}
                  </span>
                )}

                {hoveredTask.task.dueDate && (
                  <span className='calendar-task-preview-badge'>
                    Due {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(hoveredTask.task.dueDate))}
                  </span>
                )}

                {(getTaskAssignee(hoveredTask.task) || getTaskPriority(hoveredTask.task)) && (
                  <span className='calendar-task-preview-badge'>
                    {getTaskAssignee(hoveredTask.task) || getTaskPriority(hoveredTask.task)}
                  </span>
                )}
              </div>
            </div>,
            document.body,
          )}
        </section>
      </main>
    </div>
  )
}

export default CalendarPage
