import './Header.scss';

const Header = () => {
  return (
    <header className="app-header">
      <div className="app-header__left">
        <span className="app-header__brand">EngageMaterial</span>
        <span className="app-header__divider" />
        <span className="app-header__page-title">Bulk Engage</span>
      </div>
    </header>
  );
};

export default Header;
