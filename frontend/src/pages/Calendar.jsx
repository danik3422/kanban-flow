import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  ChevronRight,
  ClipboardList,
  Search,
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
  const [isLoading, setIsLoading] = useState(true)
  const {
    isSidebarOpen,
    setIsSidebarOpen,
    isSidebarCollapsed,
    setIsSidebarCollapsed,
  } = useWorkspaceNavigation()

  useEffect(() => {
    axiosInstance
      .get('/board/boards')
      .then((response) => setBoards(response.data))
      .catch((error) => {
        toast.error(error.response?.data?.message || 'Could not load rooms')
      })
      .finally(() => setIsLoading(false))
  }, [])

  const today = new Date(2026, 6, 26)
  const month = 2026
  const monthNumber = 6
  const monthName = new Intl.DateTimeFormat(undefined, { month: 'long', year: 'numeric' }).format(today)
  const days = useMemo(() => {
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
  }, [month, monthNumber])

  const sampleTasks = {
    1: ['Social media calendar', 'Landing page planning'],
    2: ['Design system review'],
    6: ['Quarterly planning deck'],
    7: ['Top tasks'],
    11: ['Launch plan'],
    14: ['Release'],
    19: ['User interview'],
    24: ['Set up authentication'],
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
            <div className='workspace-context-label'>My workspace</div>
            <div className='workspace-board-title-row'>
              <span className='workspace-board-name'>
                <ChevronRight size={13} /> Calendar
              </span>
            </div>
          </div>
        </WorkspaceTopbar>

        <section className='calendar-page workspace-content'>
          <header className='calendar-page-header'>
            <div className='calendar-title-wrap'>
              <span className='calendar-page-icon'><CalendarDays size={24} /></span>
              <div>
                <div className='calendar-kicker'>Calendar</div>
                <h1 className='calendar-heading'>Calendar</h1>
              </div>
            </div>
            <div className='calendar-page-actions'>
              <button className='calendar-page-button'><Search size={14} /> Search tasks, boards...</button>
              <button className='calendar-page-button create-button'>+ New board</button>
            </div>
          </header>

          <section className='calendar-app-frame'>
            <div className='calendar-toolbar'>
              <div className='calendar-month-switcher'>
                <span className='calendar-month-name'>{monthName}</span>
                <span className='calendar-date-pill'>37 due</span>
              </div>
              <div className='calendar-top-switch'>
                <button className='calendar-arrow'><ArrowLeft size={16} /></button>
                <button className='calendar-today'>Today</button>
                <button className='calendar-arrow'><ArrowRight size={16} /></button>
              </div>
            </div>

            <div className='calendar-weekdays'>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className='calendar-weekday'>{day}</div>
              ))}
            </div>

            <div className='calendar-days-grid'>
              {days.map((date, index) => {
                const day = date ? date.getDate() : ''
                const key = date ? date.toISOString().slice(0, 10) : `empty-${index}`
                const tasks = date ? sampleTasks[day] || [] : []
                return (
                  <div key={key} className={`calendar-day-cell ${date ? 'has-date' : 'empty-date'} ${day === 26 ? 'today-cell' : ''}`}> 
                    {date && (
                      <>
                        <div className='calendar-date-label'>{day}</div>
                        <div className='calendar-task-stack'>
                          {tasks.map((task, i) => (
                            <div key={`${task}-${i}`} className='calendar-task-chip'>
                              <span className='calendar-task-dot' />
                              <span>{task}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </section>
        </section>
      </main>
    </div>
  )
}

export default CalendarPage
