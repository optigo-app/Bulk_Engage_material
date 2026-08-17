import Header from '../Header/Header';
import Sidebar from '../Sidebar/Sidebar';
import ThemeSelector from '../ThemeSelector/ThemeSelector';
import './Layout.scss';
import { useTheme } from '../../context/ThemeContext';
import LoadingBackdrop from '../../Utils/LoadingBackdrop';
import { useRecoilState } from 'recoil';
import { isLoadingAtom } from '../../recoil/atom';

const Layout = ({ children }) => {

  const [isLoadingData, setIsLoading] = useRecoilState(isLoadingAtom);


  return (
    <div className="layout">
      {/* <Header /> */}
      <div className="layout__body">
        <Sidebar />

        <main className="layout__content" >
          <LoadingBackdrop isLoading={isLoadingData} />
          {children}
        </main>
      </div>
      <ThemeSelector />
    </div>
  );
};

export default Layout;
