import FeaturesSection from '../components/FeaturesSection'
import Footer from '../components/Footer'
import HeroSection from '../components/HeroSection'

const Home = () => {
	return (
		<div className='bg-base-100 text-base-content min-h-screen flex flex-col'>
			<HeroSection />
			<FeaturesSection />
			<Footer />
		</div>
	)
}

export default Home
