/**
 * Theme Enhanced settings section — displays theme selection and custom theme editor.
 *
 * @module ThemeEnhancedSection
 */

import type { ConnectionHandle } from '@deepseek-ai/dsh-api-remotes/client'
import type { ThemeEnhancedStore, ThemeEnhancedState, Theme, ThemeColors } from './store.ts'
import type { ThemeEnhancedKey } from './locales.ts'

/** Injected dependencies */
export interface ThemeEnhancedSectionInjected {
  /** Store controller */
  controller: ThemeEnhancedStore
  /** Snapshot selector hook */
  useSnapshot: () => ThemeEnhancedState
  /** API connection */
  api: ConnectionHandle['api']
  /** Translation function */
  t: (key: ThemeEnhancedKey) => string
}

/** Component props */
export interface ThemeEnhancedSectionProps {
  /** Injected dependencies */
  injected: ThemeEnhancedSectionInjected
  /** Close settings panel */
  close: () => void
}

/** Color keys */
const COLOR_KEYS: (keyof ThemeColors)[] = [
  'primary', 'secondary', 'background', 'surface', 'text',
  'textSecondary', 'border', 'error', 'warning', 'success', 'info',
]

/**
 * Theme Enhanced settings section component.
 */
export function ThemeEnhancedSection({ injected, close }: ThemeEnhancedSectionProps): React.ReactElement {
  const { controller, useSnapshot, t } = injected
  const state = useSnapshot()
  
  const handleSelectTheme = async (themeId: string): Promise<void> => {
    try {
      await controller.selectTheme(themeId)
    } catch (error) {
      console.error('Failed to select theme:', error)
    }
  }
  
  const handlePreview = (theme: Theme): void => {
    controller.startPreview(theme)
  }
  
  const handleStopPreview = (): void => {
    controller.stopPreview()
  }
  
  const handleEdit = (theme: Theme): void => {
    controller.startEditing(theme)
  }
  
  const handleCreateCustom = (): void => {
    const newTheme: Theme = {
      id: `custom-${Date.now()}`,
      name: 'Custom Theme',
      type: 'custom',
      colors: {
        primary: '#1a73e8',
        secondary: '#5f6368',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#202124',
        textSecondary: '#5f6368',
        border: '#dadce0',
        error: '#d93025',
        warning: '#f9ab00',
        success: '#1e8e3e',
        info: '#1a73e8',
      },
      builtin: false,
    }
    controller.startEditing(newTheme)
  }
  
  const handleColorChange = (colorKey: keyof ThemeColors, value: string): void => {
    controller.updateEditingTheme({ [colorKey]: value })
  }
  
  const handleSave = async (): Promise<void> => {
    try {
      await controller.saveCustomTheme()
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }
  
  const handleDelete = async (themeId: string): Promise<void> => {
    try {
      await controller.deleteCustomTheme(themeId)
    } catch (error) {
      console.error('Failed to delete theme:', error)
    }
  }
  
  if (state.status === 'loading') {
    return <div className="theme-enhanced-section loading">{t('status.loading')}</div>
  }
  
  if (state.status === 'error') {
    return <div className="theme-enhanced-section error">{t('status.error')}: {state.error}</div>
  }
  
  return (
    <div className="theme-enhanced-section">
      <h2>{t('title')}</h2>
      <p className="description">{t('description')}</p>
      
      <div className="current-theme">
        <label>{t('currentTheme')}:</label>
        <span className="theme-name">
          {state.themes.find(t => t.id === state.currentThemeId)?.name || 'Unknown'}
        </span>
      </div>
      
      <div className="themes-grid">
        {state.themes.map((theme) => (
          <div
            key={theme.id}
            className={`theme-card ${state.currentThemeId === theme.id ? 'active' : ''}`}
          >
            <div className="theme-preview" style={{ backgroundColor: theme.colors.background }}>
              <div className="preview-header" style={{ backgroundColor: theme.colors.primary }}></div>
              <div className="preview-sidebar" style={{ backgroundColor: theme.colors.surface }}></div>
              <div className="preview-content" style={{ backgroundColor: theme.colors.background }}>
                <div className="preview-text" style={{ backgroundColor: theme.colors.text }}></div>
                <div className="preview-text secondary" style={{ backgroundColor: theme.colors.textSecondary }}></div>
              </div>
            </div>
            
            <div className="theme-info">
              <h3>{theme.name}</h3>
              <span className="theme-type">{theme.type}</span>
            </div>
            
            <div className="theme-actions">
              <button
                className="select-button"
                onClick={() => handleSelectTheme(theme.id)}
                disabled={state.currentThemeId === theme.id}
              >
                {state.currentThemeId === theme.id ? '当前' : '选择'}
              </button>
              
              <button
                className="preview-button"
                onClick={() => handlePreview(theme)}
              >
                {t('preview')}
              </button>
              
              {!theme.builtin && (
                <>
                  <button
                    className="edit-button"
                    onClick={() => handleEdit(theme)}
                  >
                    {t('edit')}
                  </button>
                  
                  <button
                    className="delete-button"
                    onClick={() => handleDelete(theme.id)}
                  >
                    {t('delete')}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
        
        <div className="theme-card create-new" onClick={handleCreateCustom}>
          <div className="create-icon">+</div>
          <span>{t('createCustom')}</span>
        </div>
      </div>
      
      {state.previewTheme && (
        <div className="preview-overlay">
          <div className="preview-modal">
            <h3>预览: {state.previewTheme.name}</h3>
            <div className="preview-content" style={{ backgroundColor: state.previewTheme.colors.background }}>
              <div className="preview-text" style={{ color: state.previewTheme.colors.text }}>
                示例文本内容
              </div>
              <div className="preview-text secondary" style={{ color: state.previewTheme.colors.textSecondary }}>
                次要文本内容
              </div>
              <button style={{ backgroundColor: state.previewTheme.colors.primary, color: '#fff' }}>
                主要按钮
              </button>
            </div>
            <button onClick={handleStopPreview}>{t('cancel')}</button>
          </div>
        </div>
      )}
      
      {state.editingTheme && (
        <div className="editor-overlay">
          <div className="editor-modal">
            <h3>{t('edit')}: {state.editingTheme.name}</h3>
            
            <div className="color-editor">
              {COLOR_KEYS.map((colorKey) => (
                <div key={colorKey} className="color-item">
                  <label>{t(`colors.${colorKey}`)}</label>
                  <input
                    type="color"
                    value={state.editingTheme.colors[colorKey]}
                    onChange={(e) => handleColorChange(colorKey, e.target.value)}
                  />
                  <input
                    type="text"
                    value={state.editingTheme.colors[colorKey]}
                    onChange={(e) => handleColorChange(colorKey, e.target.value)}
                  />
                </div>
              ))}
            </div>
            
            <div className="editor-actions">
              <button onClick={handleSave}>{t('save')}</button>
              <button onClick={() => controller.startEditing(null)}>{t('cancel')}</button>
            </div>
          </div>
        </div>
      )}
      
      <div className="settings-footer">
        <button className="close-button" onClick={close}>
          关闭
        </button>
      </div>
    </div>
  )
}