import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Footer } from './components/Footer';
import { HomePage } from './pages/HomePage';
import { LocalGamesPage } from './pages/LocalGamesPage';
import { OnlineGamesPage } from './pages/OnlineGamesPage';
import { RoomPage } from './pages/RoomPage';
import { LocalGamePage } from './pages/LocalGamePage';
import { NotFoundPage } from './pages/NotFoundPage';

export const App: React.FC = () => {
  return (
    <BrowserRouter>
      <div className="min-h-screen flex flex-col justify-between bg-stone-950 text-stone-100 selection:bg-stone-100 selection:text-stone-950">
        <Navbar />
        <main className="flex-1 flex flex-col justify-center">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/local" element={<LocalGamesPage />} />
            <Route path="/online" element={<OnlineGamesPage />} />
            <Route path="/room/:roomCode" element={<RoomPage />} />
            <Route path="/game" element={<LocalGamePage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </main>
        <Footer />
      </div>
    </BrowserRouter>
  );
};

export default App;
