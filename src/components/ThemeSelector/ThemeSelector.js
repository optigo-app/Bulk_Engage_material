import React from 'react';
import { useTheme } from '../../context/ThemeContext';
import { Check, Moon, Sun, X, Monitor } from 'lucide-react';
import './ThemeSelector.scss';

const ThemeSelector = () => {
  const { currentTheme, themes, switchTheme, showSelector, setShowSelector } = useTheme();

  if (!showSelector) return null;

  const systemThemeId = 'system';

  const systemOption = {
    id: systemThemeId,
    name: 'System',
    description: 'Follows your device settings',
    preview: {
      bg: 'linear-gradient(135deg, #0d1b2e 50%, #f0f4f8 50%)',
      sidebar: 'linear-gradient(135deg, #1a2744 50%, #e2e8f0 50%)',
      header: 'linear-gradient(135deg, #1e3a5f 50%, #dbeafe 50%)',
      accent: 'linear-gradient(135deg, #3b82f6 50%, #2563eb 50%)',
    },
  };

  const allOptions = [systemOption, ...Object.values(themes)];

  return (
    <div className="theme-selector__overlay">
      <div className="theme-selector__modal">
        <div className="theme-selector__header">
          <h2>Choose Your Theme</h2>
          <p>Select a theme to personalize your experience</p>
          <button className="theme-selector__close" onClick={() => setShowSelector(false)}>
            <X size={18} />
          </button>
        </div>

        <div className="theme-selector__grid">
          {allOptions.map((theme) => {
            const isSelected = currentTheme === theme.id;
            const isSystem = theme.id === systemThemeId;

            return (
              <div
                key={theme.id}
                className={`theme-selector__card ${isSelected ? 'theme-selector__card--selected' : ''}`}
                onClick={() => switchTheme(theme.id)}
              >
                <div
                  className="theme-selector__preview"
                  style={{ background: theme.preview.bg }}
                >
                  <div
                    className="theme-selector__preview-sidebar"
                    style={{ background: theme.preview.sidebar }}
                  />
                  <div className="theme-selector__preview-content">
                    <div
                      className="theme-selector__preview-header"
                      style={{ background: theme.preview.header }}
                    />
                    <div className="theme-selector__preview-body">
                      {isSystem ? (
                        <>
                          <div
                            className="theme-selector__preview-card"
                            style={{
                              background: 'linear-gradient(135deg, #1a2744 50%, #ffffff 50%)',
                              border: '1px solid #4a6fa5',
                            }}
                          />
                          <div
                            className="theme-selector__preview-btn"
                            style={{ background: theme.preview.accent }}
                          />
                        </>
                      ) : (
                        <>
                          <div
                            className="theme-selector__preview-card"
                            style={{
                              background: theme.id === 'theme1' ? '#1a2744' : '#ffffff',
                              border: `1px solid ${theme.id === 'theme1' ? '#2a3f5f' : '#e2e8f0'}`,
                            }}
                          />
                          <div
                            className="theme-selector__preview-btn"
                            style={{ background: theme.preview.accent }}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="theme-selector__info">
                  <div className="theme-selector__name-row">
                    {isSystem ? (
                      <Monitor size={16} />
                    ) : theme.id === 'theme1' ? (
                      <Moon size={16} />
                    ) : (
                      <Sun size={16} />
                    )}
                    <span className="theme-selector__name">{theme.name}</span>
                    {isSelected && (
                      <div className="theme-selector__check">
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                  <span className="theme-selector__desc">{theme.description}</span>
                </div>

                <div
                  className="theme-selector__accent-strip"
                  style={{ background: theme.preview.accent }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ThemeSelector;