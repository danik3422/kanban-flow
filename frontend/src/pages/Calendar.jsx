import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  Search,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import WorkspaceSidebar from '../components/WorkspaceSidebar'
import WorkspaceTopbar from '../components/WorkspaceTopbar'
import { axiosInstance } from '../lib/axios'
import useWorkspaceNavigation from '../hooks/useWorkspaceNavigation'

const CalendarPage = () => {
  const navigate = useNavigate()
  const [boards, setBoards] = useState([])
  const [tasks, setTasks] = useState([])
  const [search, setSearch] = useState('')
  const [isLoading, setIsLoading] = useState(true)
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
      axiosInstance.get('/board/boards'),
      axiosInstance.get('/board/my-tasks'),
    ])
      .then(([boardsResponse, tasksResponse]) => {
        if (!isCurrent) return
        setBoards(boardsResponse.data)
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

  const today = new Date()
  const todayKey = today.toISOString().slice(0, 10)
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(cursorMonth)
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
    const start = new Date(month, monthNumber, 1)
    const startOffset = start.getDay()
    const daysInMonth = new Date(month, monthNumber + 1, 0).getDate()
    const grid = []
    for (let i = 0; i < startOffset; i += 1) {
      grid.push(null)
    }
    for (let d = 1; d <= daysInMonth; d += 1) {
      grid.push(new Date(month, monthNumber, d))
    }
    while (grid.length % 7 !== 0) {
      grid.push(null)
    }
    return grid
  }, [cursorMonth])

  const tasksByDate = useMemo(() => {
    const grouped = new Map()
    filteredTasks.forEach((task) => {
      const dateKey = String(task.dueDate).slice(0, 10)
      const current = grouped.get(dateKey) || []
      grouped.set(dateKey, [...current, task])
    })
    return grouped
  }, [filteredTasks])

  const moveMonth = (amount) => {
    setCursorMonth((current) => new Date(current.getFullYear(), current.getMonth() + amount, 1))
  }

  const goToday = () => setCursorMonth(new Date(today.getFullYear(), today.getMonth(), 1))

  const getTaskState = (dateKey) => {
    if (dateKey < todayKey) return 'overdue'
    if (dateKey === todayKey) return 'today'
    return 'upcoming'
  }

  return (
    <div className='workspace-shell flex h-screen'>
      <WorkspaceSidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        boards={boards}
        selectedBoardId={null}
        onBoardSelect={(board) => navigate(`/workspaces/${board._id}`)}
        onCreateBoard={() => navigate('/workspaces')}
        isCollapsed={isSidebarCollapsed}
      />
      <main className='workspace-main flex-1 overflow-auto'>
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

        <section className='calendar-page workspace-content my-tasks-page'>
          <header className='calendar-page-header'>
            <div className='calendar-title-wrap'>
              <div>
                <p className='eyebrow'>Planning view</p>
                <h1 className='my-tasks-title'>Calendar</h1>
                <p className='calendar-heading-copy'>See everything scheduled across your rooms in one calm view.</p>
              </div>
            </div>
            <div className='calendar-page-actions'>
              <label className='calendar-search'>
                <Search size={14} />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder='Search tasks or rooms'
                  aria-label='Search tasks or rooms'
                />
                {search && (
                  <button type='button' onClick={() => setSearch('')} aria-label='Clear search' title='Clear search'>
                    <X size={14} />
                  </button>
                )}
              </label>
              <button className='calendar-page-button create-button' onClick={() => navigate('/workspaces')}>
                + New board
              </button>
            </div>
          </header>

          <section className='calendar-app-frame'>
            <div className='calendar-toolbar'>
              <div className='calendar-month-switcher'>
                <span className='calendar-month-name'>{monthName}</span>
                <span className='calendar-date-pill'>{filteredTasks.length} due</span>
              </div>
              <div className='calendar-top-switch'>
                <button className='calendar-arrow' onClick={() => moveMonth(-1)} aria-label='Previous month' title='Previous month'><ArrowLeft size={16} /></button>
                <button className='calendar-today' onClick={goToday}>Today</button>
                <button className='calendar-arrow' onClick={() => moveMonth(1)} aria-label='Next month' title='Next month'><ArrowRight size={16} /></button>
              </div>
            </div>

            <div className='calendar-weekdays'>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className='calendar-weekday'>{day}</div>
              ))}
            </div>

            <div className='calendar-days-grid'>
              {days.map((date, index) => {
                const key = date ? date.toISOString().slice(0, 10) : `empty-${index}`
                const dayTasks = date ? tasksByDate.get(key) || [] : []
                return (
                  <div key={key} className={`calendar-day-cell ${date ? 'has-date' : 'empty-date'} ${key === todayKey ? 'today-cell' : ''}`}>
                    {date && (
                      <>
                        <div className='calendar-date-label'>
                          <span>{date.getDate()}</span>
                          {dayTasks.length > 0 && <small>{dayTasks.length}</small>}
                        </div>
                        <div className='calendar-task-stack'>
                          {dayTasks.slice(0, 3).map((task) => (
                            <button
                              key={task._id}
                              type='button'
                              className={`calendar-task-chip is-${getTaskState(key)}`}
                              onClick={() => task.column?.board?._id && navigate(`/workspaces/${task.column.board._id}`)}
                              title={`${task.title} - ${task.column?.board?.name || 'Room'}`}
                            >
                              <span className='calendar-task-dot' />
                              <span>{task.title}</span>
                            </button>
                          ))}
                          {dayTasks.length > 3 && <span className='calendar-more'>+{dayTasks.length - 3} more</span>}
                        </div>
                      </>
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
        </section>
      </main>
    </div>
  )
}

export default CalendarPage
