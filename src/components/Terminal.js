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
    <div className="relative h-64 bg-gray-900 rounded-lg shadow-inner">
      <div
        ref={terminalRef}
        className="absolute inset-0 p-4 font-mono text-sm text-gray-100 overflow-auto whitespace-pre-wrap"
        style={{ 
          fontFamily: "'Courier New', Courier, monospace",
          backgroundColor: '#1a1a1a',
          lineHeight: '1.4'
        }}
      >
        {formatOutput(output)}
      </div>
    </div>
  );
}

export default Terminal;
