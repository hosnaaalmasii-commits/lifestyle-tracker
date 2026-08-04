import { Component } from 'react'

// However good the fix, a device- or data-specific edge case in the
// Character System should never be able to take the rest of the app down
// with it. If anything inside throws, show a small visible fallback (so
// the actual error can be screenshotted and reported) instead of
// blanking the whole page — the rest of Overview keeps working either way.
export default class CharacterErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="text-sm faint">Companion couldn't load</div>
          <div className="text-sm faint mono" style={{ marginTop: 4, wordBreak: 'break-word' }}>
            {String(this.state.error?.message || this.state.error)}
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
