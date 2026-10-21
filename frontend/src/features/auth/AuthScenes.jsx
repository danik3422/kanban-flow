import { Check, KeyRound, Link2, Mail, ShieldCheck } from 'lucide-react'
import { useI18n } from '../../i18n'
import { Avatar, Badge } from '../../ui'
import { cx } from '../../ui/utils'
import { LogoMark } from '../../ui/BrandMark'

// Decorative scenes for the brand panel: each auth step shows its own moment of
// the product, drawn with the real components so they follow the theme.

const TEAMMATE = 'Olena Kovalenko'

export const LoginScene = () => {
	const { t } = useI18n()
	const tasks = [
		{ key: 'task1', done: true, badge: <Avatar name='Mark Wilson' size={22} decorative /> },
		{ key: 'task2', badge: <Avatar name={TEAMMATE} size={22} decorative /> },
		{ key: 'task3', badge: <Badge tone='warning'>{t('auth.scene.setup.today')}</Badge> },
	]
	return (
		<div className='auth-scene auth-scene--login'>
			<div className='auth-scene__card'>
				<div className='auth-scene__card-head'>
					<span className='auth-scene__title'>{t('auth.scene.login.today')}</span>
					<span className='auth-scene__muted'>{t('auth.scene.login.progress', { done: 1, total: 3 })}</span>
				</div>
				<span className='auth-scene__progress'><span style={{ width: '33%' }} /></span>
				<ul className='auth-scene__tasks'>
					{tasks.map((task) => (
						<li key={task.key} className={cx(task.done && 'is-done')}>
							<span className='auth-scene__check'>{task.done && <Check size={12} strokeWidth={3} />}</span>
							<span className='auth-scene__task-title'>{t(`auth.scene.login.${task.key}`)}</span>
							{task.badge}
						</li>
					))}
				</ul>
			</div>
			<div className='auth-scene__toast'>
				<Avatar name={TEAMMATE} size={32} status='online' decorative />
				<span>
					{t('auth.scene.login.activity', { name: t('auth.scene.login.teammate'), task: t('auth.scene.login.activityTask') })}
					<span className='auth-scene__muted auth-scene__toast-time'>{t('auth.scene.login.now')}</span>
				</span>
			</div>
		</div>
	)
}

export const SignupScene = () => {
	const { t } = useI18n()
	return (
		<div className='auth-scene auth-scene--signup'>
			<div className='auth-scene__card'>
				<span className='auth-scene__title'>{t('auth.scene.signup.board')}</span>
				<div className='auth-scene__board'>
					<div className='auth-scene__column'>
						<span className='auth-scene__column-title'>{t('auth.scene.signup.doing')} <b>2</b></span>
						<div className='auth-scene__mini-card auth-scene__mini-card--moving'>
							{t('auth.scene.signup.card1')}
							<Avatar name={TEAMMATE} size={22} decorative />
						</div>
						<div className='auth-scene__mini-card'>
							{t('auth.scene.signup.card2')}
							<Avatar name='Mark Wilson' size={22} decorative />
						</div>
					</div>
					<div className='auth-scene__column'>
						<span className='auth-scene__column-title'>{t('auth.scene.signup.done')} <b>1</b></span>
						<div className='auth-scene__mini-card auth-scene__mini-card--done'>
							{t('auth.scene.signup.card3')}
							<Check size={16} />
						</div>
					</div>
				</div>
			</div>
			<ol className='auth-scene__steps'>
				{['step1', 'step2', 'step3'].map((step, index) => (
					<li key={step}><span>{index + 1}</span>{t(`auth.scene.signup.${step}`)}</li>
				))}
			</ol>
		</div>
	)
}

export const RecoveryScene = () => {
	const { t } = useI18n()
	const steps = [
		{ key: 'step1', icon: Mail, state: 'done' },
		{ key: 'step2', icon: Link2, state: 'active' },
		{ key: 'step3', icon: KeyRound, state: 'next' },
	]
	return (
		<div className='auth-scene auth-scene--recovery'>
			<div className='auth-scene__card'>
				<ol className='auth-scene__timeline'>
					{steps.map(({ key, icon: Icon, state }) => (
						<li key={key} className={`is-${state}`}>
							<span className='auth-scene__timeline-icon'>{state === 'done' ? <Check size={16} strokeWidth={3} /> : <Icon size={16} />}</span>
							{t(`auth.scene.recovery.${key}`)}
						</li>
					))}
				</ol>
				<p className='auth-scene__note'><ShieldCheck size={16} />{t('auth.scene.recovery.note')}</p>
			</div>
		</div>
	)
}

export const VerifyScene = () => {
	const { t } = useI18n()
	return (
		<div className='auth-scene auth-scene--verify'>
			<div className='auth-scene__card auth-scene__mail'>
				<div className='auth-scene__card-head'>
					<span className='auth-scene__title'>{t('auth.scene.verify.inbox')}</span>
					<Badge tone='accent' pill>1</Badge>
				</div>
				<div className='auth-scene__mail-row'>
					<LogoMark size={32} />
					<span className='auth-scene__mail-meta'>
						<b>{t('auth.scene.verify.from')}</b>
						<span>{t('auth.scene.verify.subject')}</span>
					</span>
					<span className='auth-scene__muted'>{t('auth.scene.verify.now')}</span>
				</div>
				<div className='auth-scene__mail-body'>
					<span className='auth-scene__title'>{t('auth.scene.verify.subject')}</span>
					<span className='auth-scene__muted'>{t('auth.scene.verify.body')}</span>
					<span className='auth-scene__fake-button'>{t('auth.scene.verify.button')}</span>
				</div>
			</div>
		</div>
	)
}

/** Live preview of the profile being filled in on the setup page. */
export const ProfileScene = ({ name, jobTitle, avatar, fallbackName }) => {
	const { t } = useI18n()
	const avatarName = name.trim() || fallbackName
	const displayName = name.trim() || t('auth.scene.setup.name')
	return (
		<div className='auth-scene auth-scene--setup'>
			<span className='auth-scene__caption'>{t('auth.scene.setup.caption')}</span>
			<div className='auth-scene__card auth-scene__profile'>
				<Avatar name={avatarName} src={avatar} size={72} status='online' decorative />
				<span className={cx('auth-scene__profile-name', !name.trim() && 'is-placeholder')}>{displayName}</span>
				<span className='auth-scene__muted'>{jobTitle.trim() || t('auth.scene.setup.job')}</span>
			</div>
			<div className='auth-scene__card auth-scene__assigned'>
				<span className='auth-scene__task-title'>{t('auth.scene.setup.task')}</span>
				<span className='auth-scene__assigned-row'>
					<Badge tone='warning'>{t('auth.scene.setup.today')}</Badge>
					<span className='auth-scene__assignee'>
						<Avatar name={avatarName} src={avatar} size={22} decorative />
						{displayName}
					</span>
				</span>
			</div>
		</div>
	)
}
