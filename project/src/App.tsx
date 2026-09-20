import Navbar from '@/components/Navbar';
import Hero from '@/components/Hero';
import GameSection from '@/components/GameSection';
import Leaderboard from '@/components/Leaderboard';
import About from '@/components/About';
import Footer from '@/components/Footer';

function App() {
  return (
    <div className="min-h-screen bg-[#0a0a12] text-white">
      <Navbar />
      <Hero />
      <GameSection />
      <Leaderboard />
      <About />
      <Footer />
    </div>
  );
}

export default App;
