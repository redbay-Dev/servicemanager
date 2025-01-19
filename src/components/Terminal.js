import React, { useRef, useEffect } from 'react';

function Terminal({ output }) {
  const terminalRef = useRef(null);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [output]);

  const formatOutput = (text) => {
    return text.split('\n').map((line, i) => (
      <div 
        key={i} 
        dangerouslySetInnerHTML={{
          __html: line.replace(/\x1b\[(\d+)m/g, (match, code) => {
            switch (code) {
              case '31': return '<span style="color: #ff6b6b;">'; // Red
              case '32': return '<span style="color: #51cf66;">'; // Green
              case '33': return '<span style="color: #ffd43b;">'; // Yellow
              case '0': return '</span>';
              default: return '';
            }
          })
        }} 
      />
    ));
  };

  return (
    <div
      ref={terminalRef}
      className="h-64 p-6 font-mono text-sm text-gray-200 overflow-auto whitespace-pre-wrap bg-gray-900"
      style={{ 
        fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace",
        lineHeight: '1.5',
        scrollBehavior: 'smooth'
      }}
    >
      {formatOutput(output)}
    </div>
  );
}

export default Terminal;
