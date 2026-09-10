import { memo } from 'react';
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  useNodes,
  type EdgeProps,
  type Edge,
  type Node,
  MarkerType,
} from '@xyflow/react';

export const edgeColorMap: Record<string, string> = {
  trigger: '#10b981',
  text: '#3b82f6',
  interactive: '#8b5cf6',
  confirmation: '#10b981',
  media: '#f43f5e',
  catalog: '#f59e0b',
  capture: '#06b6d4',
  capture_phone: '#10b981',
  condition: '#f59e0b',
  delay: '#64748b',
  webhook: '#f97316',
  handoff: '#ef4444',
  llm: '#7c3aed',
  knowledge_retrieval: '#14b8a6',
  email: '#ec4899',
};

function colorForNode(node: Node | undefined): string {
  const type = (node as any)?.type as string | undefined;
  return edgeColorMap[type || ''] || '#6366f1';
}

function CustomEdge({
  id,
  source,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
  data,
}: EdgeProps) {
  const nodes = useNodes();
  const sourceNode = nodes.find((n) => n.id === source);
  const edgeData = data as Record<string, unknown> | undefined;
  const color = typeof edgeData?.color === 'string' ? edgeData.color : colorForNode(sourceNode);

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
    curvature: 0.35,
  });

  const showLabel = typeof edgeData?.label === 'string' && edgeData.label.trim() !== '';

  const arrow = {
    type: MarkerType.ArrowClosed,
    color,
    width: 20,
    height: 20,
  };

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={arrow as never}
        style={{
          stroke: color,
          strokeWidth: selected ? 3 : 2,
          strokeOpacity: selected ? 1 : 0.85,
          transition: 'all 0.2s ease',
        }}
        className="flow-edge-path"
      />
      {showLabel && (
        <EdgeLabelRenderer>
          <div
            className="absolute pointer-events-auto nodrag nopan text-[9px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
            style={{
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              color: '#fff',
              background: color,
              boxShadow: '0 2px 8px rgba(0,0,0,0.25)',
              letterSpacing: '0.02em',
            }}
          >
            {typeof edgeData?.label === 'string' ? edgeData.label : ''}
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export default memo(CustomEdge);

export type { Edge, Node };
