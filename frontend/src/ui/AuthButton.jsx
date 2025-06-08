import { FaApple, FaMicrosoft } from 'react-icons/fa'
import { FcGoogle } from 'react-icons/fc'

const icons = {
	google: <FcGoogle className='text-xl' />,
	microsoft: <FaMicrosoft className='text-xl' />,
	apple: <FaApple className='text-xl' />,
}

const styles = {
	google: 'bg-white text-black border border-gray-300 hover:bg-gray-100',
	microsoft: 'bg-[#2F2F2F] text-white hover:bg-[#1f1f1f]',
	apple: 'bg-black text-white hover:bg-gray-900',
}

const labels = {
	google: 'Continue with Google',
	microsoft: 'Continue with Microsoft',
	apple: 'Continue with Apple',
}

const AuthButton = ({ provider, onClick }) => {
	if (!icons[provider]) return null

	return (
		<button
			onClick={onClick}
			className={`btn w-full justify-center gap-3 ${styles[provider]}`}
		>
			{icons[provider]}
			{labels[provider]}
		</button>
	)
}

export default AuthButton
