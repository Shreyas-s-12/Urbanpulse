'use client';

import React, { useState } from 'react';
import { CrossDomainGraph, GraphNode } from '@/types/command';

interface IntelligenceGraphViewerProps {
  graph: CrossDomainGraph | null;
  onSelectNode?: (node: GraphNode) => void;
  onClose?: () => void;
}

export default function IntelligenceGraphViewer({
  graph,
  onSelectNode,
  onClose,
}: IntelligenceGraphViewerProps) {
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);

  if (!graph) return null;

  const handleNodeClick = (node: GraphNode) => {
    setSelectedNode(node);
    if (onSelectNode) onSelectNode(node);
  };

  const getNodeColor = (type: string) => {
    switch (type.toUpperCase()) {
      case 'LOCATION':
        return '#2563EB'; // Blue
      case 'WEATHER':
        return '#0284C7'; // Cyan
      case 'TRAFFIC':
        return '#DC2626'; // Red
      case 'ENVIRONMENT':
        return '#059669'; // Green
      case 'EVENT':
        return '#D97706'; // Amber
      case 'ROAD':
        return '#4B5563'; // Gray
      default:
        return '#6B7280';
    }
  };

  // Generate circular graph layout coordinates
  const width = 640;
  const height = 480;
  const centerX = width / 2;
  const centerY = height / 2;
  const radius = Math.min(centerX, centerY) - 70;

  const nodePositions: Record<string, { x: number; y: number }> = {};
  const nonCenterNodes = graph.nodes.filter((n) => n.id !== graph.focusNodeId);

  // Center node at middle
  nodePositions[graph.focusNodeId] = { x: centerX, y: centerY };

  // Arrange other nodes radially
  nonCenterNodes.forEach((n, idx) => {
    const angle = (2 * Math.PI * idx) / Math.max(nonCenterNodes.length, 1);
    nodePositions[n.id] = {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
    };
  });

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        backgroundColor: '#FFFFFF',
        borderLeft: '1px solid #E5E7EB',
        width: '460px',
        overflowY: 'auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #E5E7EB',
          backgroundColor: '#F9FAFB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <div>
          <span style={{ fontSize: '10px', fontWeight: 700, color: '#2563EB', textTransform: 'uppercase' }}>
            CROSS-DOMAIN INTELLIGENCE GRAPH
          </span>
          <h2 style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: 0 }}>
            {graph.centerLocation} ({graph.totalNodes} Nodes, {graph.totalEdges} Edges)
          </h2>
        </div>
        {onClose && (
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280' }}>
            ✕
          </button>
        )}
      </div>

      {/* Provenance Badge Bar */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          padding: '8px 16px',
          backgroundColor: '#EFF6FF',
          borderBottom: '1px solid #DBEAFE',
          fontSize: '11px',
          color: '#1E40AF',
        }}
      >
        <span>
          <strong>Observed Links:</strong> {graph.provenance?.observedEdges || 0}
        </span>
        <span>
          <strong>Inferred Links:</strong> {graph.provenance?.inferredEdges || 0}
        </span>
      </div>

      {/* SVG Canvas */}
      <div style={{ position: 'relative', width: '100%', height: '320px', backgroundColor: '#F8FAFC', overflow: 'hidden' }}>
        <svg width="100%" height="100%" viewBox={`0 0 ${width} ${height}`}>
          {/* Render Edges */}
          {graph.edges.map((e) => {
            const p1 = nodePositions[e.source];
            const p2 = nodePositions[e.target];
            if (!p1 || !p2) return null;
            const isObserved = e.nature === 'OBSERVED';
            return (
              <g key={e.id}>
                <line
                  x1={p1.x}
                  y1={p1.y}
                  x2={p2.x}
                  y2={p2.y}
                  stroke={isObserved ? '#2563EB' : '#D97706'}
                  strokeWidth={isObserved ? 2 : 1.5}
                  strokeDasharray={isObserved ? 'none' : '4 3'}
                  opacity={0.7}
                />
              </g>
            );
          })}

          {/* Render Nodes */}
          {graph.nodes.map((n) => {
            const p = nodePositions[n.id] || { x: centerX, y: centerY };
            const isSelected = selectedNode?.id === n.id;
            const color = getNodeColor(n.type);

            return (
              <g
                key={n.id}
                transform={`translate(${p.x}, ${p.y})`}
                onClick={() => handleNodeClick(n)}
                style={{ cursor: 'pointer' }}
              >
                <circle
                  r={isSelected ? 16 : 12}
                  fill={color}
                  stroke="#FFFFFF"
                  strokeWidth={2}
                  opacity={0.95}
                />
                <text
                  y={22}
                  textAnchor="middle"
                  fontSize="9px"
                  fontWeight="600"
                  fill="#1E293B"
                >
                  {n.label.length > 14 ? `${n.label.slice(0, 14)}…` : n.label}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Node Inspection Card */}
      <div style={{ padding: '14px 16px', flex: 1, overflowY: 'auto' }}>
        {selectedNode ? (
          <div style={{ padding: '12px', backgroundColor: '#F9FAFB', borderRadius: '6px', border: '1px solid #E5E7EB' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span
                style={{
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  backgroundColor: '#DBEAFE',
                  color: '#1E40AF',
                }}
              >
                {selectedNode.type}
              </span>
              <span style={{ fontSize: '10px', color: '#6B7280' }}>
                Confidence: {Math.round(selectedNode.confidence * 100)}%
              </span>
            </div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, color: '#111827', margin: '0 0 6px 0' }}>
              {selectedNode.label}
            </h3>
            <div style={{ fontSize: '11px', color: '#4B5563', marginBottom: '4px' }}>
              <strong>Source:</strong> {selectedNode.source}
            </div>
            <div style={{ fontSize: '11px', color: '#4B5563', marginBottom: '6px' }}>
              <strong>Category:</strong> {selectedNode.category}
            </div>
            <div style={{ fontSize: '10px', color: '#6B7280' }}>
              <strong>Observed:</strong> {new Date(selectedNode.timestamp).toLocaleString()}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: '12px', color: '#6B7280', textAlign: 'center', padding: '24px 0' }}>
            Select any graph node or relationship edge above to inspect provenance, telemetry, and evidence.
          </div>
        )}
      </div>
    </div>
  );
}
