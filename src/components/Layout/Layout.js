import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import ThemeSelector from '../ThemeSelector/ThemeSelector';
import './Layout.scss';
import { useTheme } from '../../context/ThemeContext';
import { Palette, Sun, Moon } from 'lucide-react';

const Layout = ({ children }) => {
  
  const { currentTheme, toggleSelector } = useTheme();
  return (
    <div className="layout">
      {/* <Header /> */}
      <div className="layout__body">
        <Sidebar />
        <button className="app-header__theme-btn" onClick={toggleSelector} title="Switch Theme" style={{ position: 'absolute', top: '15px', right: '10px', backgroundColor: '#6366f1', zIndex: 999999 }}>
          {currentTheme === 'theme1' ? <Moon size={16} /> : <Sun size={16} />}
          <span>{currentTheme === 'theme1' ? 'Dark' : currentTheme === 'system' ?  'system' : 'Light'}</span>
          <Palette size={14} />
        </button>
        <main className="layout__content" >
          {children}
        </main>
      </div>
      <ThemeSelector />
    </div>
  );
};

export default Layout;
