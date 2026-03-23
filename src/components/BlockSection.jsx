export default function BlockSection({ block }) {
  const label = block.value
    ? `${block.value.toUpperCase()} ${block.units ? `/ ${block.units}` : ''}`.trim()
    : block.units || 'BLOCK';

  return (
    <div className="block-section">
      <h3 className="block-section__label">{label}</h3>
    </div>
  );
}
