import React, { useEffect } from 'react';
import { useUiStore } from './store/uiStore';
import Home from './pages/Home';
import Catalog from './pages/Catalog';
import Generate from './pages/Generate';
import Progress from './pages/Progress';
import History from './pages/History';
import Balance from './pages/Balance';
import Profile from './pages/Profile';

const App: React.FC = () => {
  const { currentPage } = useUiStore();

  // Инициализация Telegram WebApp
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (tg) {
      tg.ready();
      tg.expand();
    }
  }, []);

  // BackButton — показываем на всех страницах кроме home
  useEffect(() => {
    const tg = window.Telegram?.WebApp;
    if (!tg) return;

    const back = tg.BackButton;

    if (currentPage !== 'home') {
      back.show();
      const handleBack = () => {
        useUiStore.getState().setPage('home');
      };
      back.onClick(handleBack);
      return () => {
        back.offClick(handleBack);
        back.hide();
      };
    } else {
      back.hide();
    }
  }, [currentPage]);

  // Роутинг по страницам
  switch (currentPage) {
    case 'home':     return <Home />;
    case 'catalog':  return <Catalog />;
    case 'generate': return <Generate />;
    case 'progress': return <Progress />;
    case 'history':  return <History />;
    case 'balance':  return <Balance />;
    case 'profile':  return <Profile />;
    default:         return <Home />;
  }
};

export default App;
