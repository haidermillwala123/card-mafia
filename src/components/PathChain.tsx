// Programmes as a chain with the ratio on each hop: HDFC 1:1 Finnair 1:1 BA 1:1 Qatar.
export default function PathChain({ nodes, ratios }: { nodes: string[]; ratios: string[] }) {
  return (
    <ol className="chain" aria-label={`Path: ${nodes.join(' to ')}`}>
      {nodes.map((n, i) => (
        <li key={`${n}-${i}`} style={{ display: 'contents' }}>
          {i > 0 && <span className="ratio" aria-label={`ratio ${ratios[i - 1]}`}>{ratios[i - 1]}</span>}
          <span className={i === nodes.length - 1 ? 'node end' : 'node'}>{n}</span>
        </li>
      ))}
    </ol>
  );
}
