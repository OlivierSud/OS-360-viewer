import React from 'react';

const Toolbar: React.FC = () => {
  return (
    <header className="toolbar">
      <h1>Virtual Tour Editor</h1>
      <div className="toolbar-actions">
        <button>Save</button>
        <button>Export</button>
      </div>
    </header>
  );
};

export default Toolbar;
