// 캔버스 업데이트
  useEffect(() => {
    if (flowchartData) {
      renderFlowchart();
    }
  }, [flowchartData, darkMode, chartType]);
  // 편집 모드 관련 상태 추가
  const [selectedStep, setSelectedStep] = useState(null);
  const [editingText, setEditingText] = useState('');
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingNode, setEditingNode] = useState(null);
  const [draggingNodeId, setDraggingNodeId] = useState(null);
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });
  
  // 노드 클릭 핸들러 (편집 모드에서 동작)
  const handleNodeClick = (event) => {
    if (!editMode || !flowchartData || !flowchartData.steps) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 클릭한 위치에 있는 노드 찾기
    const clickedNode = flowchartData.steps.find(step => {
      if (!step || !step.position || !step.type) return false;
      
      const { position, type } = step;
      
      // 노드 타입에 따른 히트 영역 계산
      let width, height;
      
      switch(type) {
        case 'start':
        case 'end':
          // 타원형 히트 체크
          const dx = x - position.x;
          const dy = y - position.y;
          return (dx * dx) / (100 * 100) + (dy * dy) / (50 * 50) <= 1;
        case 'decision':
          // 마름모 히트 체크 (단순화를 위해 사각형으로 대체)
          return x >= position.x - 120 && x <= position.x + 120 &&
                 y >= position.y - 60 && y <= position.y + 60;
        case 'big-category':
          width = 240;
          height = 100;
          break;
        case 'mid-category':
          width = 220;
          height = 90;
          break;
        case 'small-category':
        case 'process':
        default:
          width = 200;
          height = 80;
      }
      
      // 사각형 히트 체크
      return x >= position.x - width/2 && x <= position.x + width/2 &&
             y >= position.y - height/2 && y <= position.y + height/2;
    });
    
    if (clickedNode) {
      setSelectedStep(clickedNode);
      setEditingText(clickedNode.originalText || clickedNode.text || '');
      setEditingNode({...clickedNode});  // 복사본 생성하여 원본 데이터 보존
      setShowEditModal(true);
    }
  };
  
  // 노드 드래그 시작 핸들러
  const handleNodeDragStart = (event) => {
    if (!editMode || !flowchartData || !selectedStep) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    setDraggingNodeId(selectedStep.id);
    setMouseOffset({
      x: x - (selectedStep.position?.x || 0),
      y: y - (selectedStep.position?.y || 0)
    });
  };
  
  // 노드 드래그 중 핸들러
  const handleNodeDrag = (event) => {
    if (!editMode || !flowchartData || !draggingNodeId || !flowchartData.steps) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 플로우차트 데이터 복사
    const updatedSteps = flowchartData.steps.map(step => {
      if (!step) return step;
      
      if (step.id === draggingNodeId) {
        return {
          ...step,
          position: {
            x: x - mouseOffset.x,
            y: y - mouseOffset.y
          }
        };
      }
      return step;
    });
    
    setFlowchartData({
      ...flowchartData,
      steps: updatedSteps
    });
  };
  
  // 노드 드래그 종료 핸들러
  const handleNodeDragEnd = () => {
    setDraggingNodeId(null);
  };
  
  // 노드 편집 확인 핸들러
  const handleEditConfirm = () => {
    if (!editingNode || !flowchartData) return;
    
    // 텍스트 분석 및 키워드 추출
    const keywordText = extractKeywords(editingText);
    
    // 플로우차트 데이터 업데이트
    const updatedSteps = flowchartData.steps.map(step => {
      if (step.id === editingNode.id) {
        return {
          ...step,
          text: keywordText,
          originalText: editingText
        };
      }
      return step;
    });
    
    setFlowchartData({
      ...flowchartData,
      steps: updatedSteps
    });
    
    // 편집 상태 초기화
    setShowEditModal(false);
    setEditingNode(null);
    setEditingText('');
  };
  
  // 노드 삭제 핸들러
  const handleDeleteNode = () => {
    if (!editingNode || !flowchartData) return;
    
    // 삭제할 노드 ID
    const nodeIdToDelete = editingNode.id;
    
    // 연결 재조정 (삭제된 노드로 향하는 연결을 삭제된 노드의 다음 노드로 리다이렉트)
    const stepsToKeep = flowchartData.steps.filter(step => step.id !== nodeIdToDelete);
    
    // 연결 업데이트
    const updatedSteps = stepsToKeep.map(step => {
      // 현재 스텝이 삭제될 노드와 연결되어 있는지 확인
      if (step.connections && step.connections.includes(nodeIdToDelete)) {
        // 삭제될 노드의 다음 연결을 찾음
        const deletedNodeIndex = flowchartData.steps.findIndex(s => s.id === nodeIdToDelete);
        const deletedNode = flowchartData.steps[deletedNodeIndex];
        
        if (deletedNode && deletedNode.connections && deletedNode.connections.length > 0) {
          // 삭제된 노드의 연결을 현재 노드의 연결로 대체
          return {
            ...step,
            connections: [
              ...step.connections.filter(id => id !== nodeIdToDelete),
              ...deletedNode.connections
            ]
          };
        } else {
          // 삭제된 노드에 연결이 없으면 해당 연결만 제거
          return {
            ...step,
            connections: step.connections.filter(id => id !== nodeIdToDelete)
          };
        }
      }
      
      return step;
    });
    
    // 플로우차트 데이터 업데이트
    setFlowchartData({
      ...flowchartData,
      steps: updatedSteps
    });
    
    // 편집 상태 초기화
    setShowEditModal(false);
    setEditingNode(null);
    setEditingText('');
    setSelectedStep(null);
  };
  
  // 새 노드 추가 핸들러
  const addNewNode = (type) => {
    if (!flowchartData) return;
    
    // 새 노드 ID 생성
    const newId = 'step-' + Date.now();
    
    // 기본 위치 계산 (마지막 노드 아래)
    const lastNode = flowchartData.steps[flowchartData.steps.length - 1];
    const newX = lastNode ? lastNode.position.x : 350;
    const newY = lastNode ? lastNode.position.y + 150 : 100;
    
    // 새 노드 생성
    const newNode = {
      id: newId,
      type: type || 'process',
      text: '새 단계',
      originalText: '새 단계',
      label: '',
      position: { x: newX, y: newY },
      connections: []
    };
    
    // 마지막 노드의 연결을 새 노드로 업데이트
    const updatedSteps = flowchartData.steps.map((step, index) => {
      if (index === flowchartData.steps.length - 1) {
        return {
          ...step,
          connections: [newId]
        };
      }
      return step;
    });
    
    // 플로우차트 데이터 업데이트
    setFlowchartData({
      ...flowchartData,
      steps: [...updatedSteps, newNode]
    });
  };import React, { useState, useRef, useEffect } from 'react';
import { Save, Edit, FileText, Settings, Download, Trash, Plus, X } from 'lucide-react';

// 폴더 아이콘 컴포넌트
const FolderOpen = ({ size }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 19a2 2 0 01-2-2V7a2 2 0 012-2h4l2 2h4a2 2 0 012 2v1M5 19h14a2 2 0 002-2v-5a2 2 0 00-2-2H9a2 2 0 00-2 2v5a2 2 0 01-2 2z"></path>
    </svg>
  );
};

// 메인 애플리케이션 컴포넌트
const FlowchartGenerator = () => {
  // 상태 관리
  const [businessDescription, setBusinessDescription] = useState('');
  const [flowchartTitle, setFlowchartTitle] = useState('');
  const [flowchartData, setFlowchartData] = useState(null);
  const [editMode, setEditMode] = useState(false);
  const [savedFlowcharts, setSavedFlowcharts] = useState([]);
  const [currentProject, setCurrentProject] = useState('새 프로젝트');
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [projectName, setProjectName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [savePath, setSavePath] = useState('C:/FlowchartProjects');
  const [darkMode, setDarkMode] = useState(false);
  const [currentNumberingLevel, setCurrentNumberingLevel] = useState(null);
  const [chartType, setChartType] = useState('flowchart');
  const [exportFormat, setExportFormat] = useState('png');
  
  const canvasRef = useRef(null);
  
  // 텍스트를 플로우차트 데이터로 변환하는 함수
  const parseBusinessDescription = (text) => {
    setIsLoading(true);
    
    setTimeout(() => {
      const lines = text.split('\n').filter(line => line.trim() !== '');
      const steps = lines.map((line, index) => {
        // 번호 체계 감지 및 라벨 설정
        let label = '';
        let type = 'process';
        let originalText = line.trim();
        
        // 대분류 [1] 패턴 확인
        if (line.includes('[') && line.includes(']')) {
          const startIdx = line.indexOf('[');
          const endIdx = line.indexOf(']');
          if (startIdx < endIdx) {
            const numberStr = line.substring(startIdx + 1, endIdx);
            if (!isNaN(parseInt(numberStr))) {
              label = '[' + numberStr + ']';
              type = 'big-category';
              // 번호 제외한 텍스트 추출
              originalText = line.substring(0, startIdx).trim() + ' ' + line.substring(endIdx + 1).trim();
            }
          }
        } 
        // 중분류 {1) 패턴 확인
        else if (line.includes('{') && line.includes(')')) {
          const startIdx = line.indexOf('{');
          const endIdx = line.indexOf(')');
          if (startIdx < endIdx) {
            const numberStr = line.substring(startIdx + 1, endIdx);
            if (!isNaN(parseInt(numberStr))) {
              label = '{' + numberStr + ')';
              type = 'mid-category';
              // 번호 제외한 텍스트 추출
              originalText = line.substring(0, startIdx).trim() + ' ' + line.substring(endIdx + 1).trim();
            }
          }
        } 
        // 소분류 ① 패턴 확인
        else {
          const circleNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', 
                               '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
          for (const circleNum of circleNumbers) {
            if (line.includes(circleNum)) {
              label = circleNum;
              type = 'small-category';
              // 번호 제외한 텍스트 추출
              originalText = line.replace(circleNum, '').trim();
              break;
            }
          }
        }
        
        // 번호가 없는 경우 자동 부여
        if (label === '') {
          if (index === 0) {
            label = '[1]';
            type = 'start';
          } else if (index === lines.length - 1) {
            label = '[' + (Math.max(1, index)) + ']';
            type = 'end';
          } else if (index % 3 === 0) {
            label = '[' + (Math.floor(index / 3) + 1) + ']';
            type = 'big-category';
          } else if (index % 3 === 1) {
            label = '{' + (Math.floor(index / 3) + 1) + ')';
            type = 'mid-category';
          } else {
            const circleIdx = (index % 3) - 2;
            const circleNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
            label = circleNumbers[circleIdx >= 0 ? circleIdx % 10 : 0];
            type = 'small-category';
          }
        }
        
        // 판단 단계 감지 (조건이나 판단을 나타내는 키워드가 있는 경우)
        const decisionKeywords = ['판단', '결정', '조건', '확인', '체크', '검증', '검토', '점검', '승인', '결재', '?', '여부'];
        if (decisionKeywords.some(keyword => originalText.includes(keyword))) {
          type = 'decision';
        }
        
        // 핵심 단어 추출
        let keywordText = extractKeywords(originalText);
        
        // 시작과 끝 노드 설정 (특정 키워드가 있는 경우)
        const startKeywords = ['시작', '요청', '신청', '접수', '입력', '등록'];
        const endKeywords = ['종료', '완료', '마감', '제출', '출력', '발행', '배포', '전송', '결과'];
        
        if (index === 0 || startKeywords.some(keyword => originalText.toLowerCase().includes(keyword))) {
          type = 'start';
        } else if (index === lines.length - 1 || endKeywords.some(keyword => originalText.toLowerCase().includes(keyword))) {
          type = 'end';
        }
        
        // 들여쓰기 수준에 따른 X 좌표 조정
        let xPosition = 350;
        if (type === 'mid-category') xPosition = 350;
        if (type === 'small-category') xPosition = 400;
        
        return {
          id: 'step-' + index,
          type: type,
          text: keywordText,
          originalText: originalText,
          label: label,
          position: { x: xPosition, y: 100 + (index * 150) },
          connections: index < lines.length - 1 ? ['step-' + (index + 1)] : []
        };
      });
      
      setFlowchartData({ 
        steps, 
        title: flowchartTitle,
        originalDescription: businessDescription
      });
      setIsLoading(false);
    }, 1000);
  };
  
  // 텍스트에서 핵심 키워드 추출
  const extractKeywords = (text) => {
    // 1. 불필요한 조사, 부사 등 제거
    const stopWords = ['은', '는', '이', '가', '을', '를', '에', '의', '로', '으로', '와', '과', '이고', '하고', '하며', '에서', '에게', '부터'];
    
    // 2. 문장 분해 및 핵심 단어 추출
    let words = text.split(' ');
    
    // 너무 긴 경우 짧게 처리
    if (words.length > 5) {
      // 첫 부분과 마지막 부분의 중요 단어 추출
      const firstPart = words.slice(0, 2).filter(word => !stopWords.some(stop => word.endsWith(stop)));
      const lastPart = words.slice(-2).filter(word => !stopWords.some(stop => word.endsWith(stop)));
      
      // 중간 부분에서 중요 단어 키워드 추출
      const middlePart = words.slice(2, -2)
        .filter(word => word.length > 1)
        .filter(word => !stopWords.some(stop => word.endsWith(stop)))
        .slice(0, 2);
      
      words = [...firstPart, ...middlePart, ...lastPart];
    }
    
    // 결과 조합
    const result = words.join(' ');
    
    // 결과가 원본보다 크게 짧아지지 않았다면 원본 반환
    if (result.length > text.length * 0.7) {
      // 30자 이상일 경우 앞의 30자만 반환
      if (text.length > 30) {
        return text.substring(0, 27) + '...';
      }
      return text;
    }
    
    return result;
  };
  
  // 플로우차트 생성 핸들러
  const handleGenerateFlowchart = () => {
    if (businessDescription.trim() === '') return;
    parseBusinessDescription(businessDescription);
  };
  
  // 플로우차트 저장 핸들러
  const handleSaveFlowchart = () => {
    if (!flowchartData) return;
    
    const newChart = {
      id: Date.now().toString(),
      name: projectName || currentProject,
      data: flowchartData,
      title: flowchartTitle,
      description: businessDescription,
      createdAt: new Date().toISOString()
    };
    
    setSavedFlowcharts([...savedFlowcharts, newChart]);
    setCurrentProject(projectName || currentProject);
    setShowSaveModal(false);
    setProjectName('');
    
    // 실제 앱에서는 여기서 파일 시스템에 저장하는 로직이 구현됩니다
    console.log('Saved to ' + savePath + '/' + newChart.name + '.json');
  };
  
  // 플로우차트 로딩 핸들러
  const handleLoadFlowchart = (id) => {
    const flowchart = savedFlowcharts.find(chart => chart.id === id);
    if (flowchart) {
      setFlowchartData(flowchart.data);
      setBusinessDescription(flowchart.description);
      setFlowchartTitle(flowchart.title || '');
      setCurrentProject(flowchart.name);
    }
  };
  
  // 편집 모드 토글
  const toggleEditMode = () => {
    setEditMode(!editMode);
  };
  
  // 노드 유형에 따른 색상 반환
  const getNodeColor = (type, isDark) => {
    if (!type) return isDark ? '#9C27B0' : '#673AB7'; // 기본 색상
    
    switch(type) {
      case 'start':
        return isDark ? '#4CAF50' : '#8BC34A';  // 초록색 계열 (시작)
      case 'end':
        return isDark ? '#F44336' : '#FF5722';  // 빨간색 계열 (종료)
      case 'decision':
        return isDark ? '#2196F3' : '#03A9F4';  // 파란색 계열 (판단)
      case 'process':
        return isDark ? '#FF9800' : '#FFC107';  // 노란색 계열 (처리)
      case 'big-category':
        return isDark ? '#9C27B0' : '#673AB7';  // 보라색 계열 (대분류)
      case 'mid-category':
        return isDark ? '#1976D2' : '#2196F3';  // 파란색 계열 (중분류)
      case 'small-category':
        return isDark ? '#00796B' : '#009688';  // 청록색 계열 (소분류)
      default:
        return isDark ? '#9C27B0' : '#673AB7';  // 기본 색상
    }
  };
  
  // 표준 플로우차트 렌더링
  const renderStandardFlowchart = (ctx, data) => {
    if (!data || !data.steps || !Array.isArray(data.steps)) return;
    
    data.steps.forEach(step => {
      if (!step || !step.position || !step.type) return;
      
      ctx.save();
      
      const position = step.position;
      const type = step.type;
      
      // 도형 타입에 따라 다른 스타일과 모양 적용 (표준 플로우차트 기호에 맞게)
      switch(type) {
        case 'start':
        case 'end':
          // 타원형 (시작/종료)
          ctx.fillStyle = getNodeColor(type, darkMode);
          ctx.beginPath();
          ctx.ellipse(position.x, position.y, 100, 50, 0, 0, 2 * Math.PI);
          ctx.fill();
          // 테두리 추가
          ctx.strokeStyle = darkMode ? '#FFFFFF' : '#333333';
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        case 'decision':
          // 마름모 (판단)
          ctx.fillStyle = getNodeColor(step.type, darkMode);
          ctx.beginPath();
          ctx.moveTo(step.position.x, step.position.y - 60);
          ctx.lineTo(step.position.x + 120, step.position.y);
          ctx.lineTo(step.position.x, step.position.y + 60);
          ctx.lineTo(step.position.x - 120, step.position.y);
          ctx.closePath();
          ctx.fill();
          // 테두리 추가
          ctx.strokeStyle = darkMode ? '#FFFFFF' : '#333333';
          ctx.lineWidth = 2;
          ctx.stroke();
          break;
        case 'process':
          // 직사각형 (처리)
          ctx.fillStyle = getNodeColor(step.type, darkMode);
          ctx.fillRect(step.position.x - 100, step.position.y - 40, 200, 80);
          // 테두리 추가
          ctx.strokeStyle = darkMode ? '#FFFFFF' : '#333333';
          ctx.lineWidth = 2;
          ctx.strokeRect(step.position.x - 100, step.position.y - 40, 200, 80);
          break;
        case 'big-category':
          // 큰 직사각형 (대분류)
          ctx.fillStyle = getNodeColor(step.type, darkMode);
          ctx.fillRect(step.position.x - 120, step.position.y - 50, 240, 100);
          // 테두리 추가
          ctx.strokeStyle = darkMode ? '#FFFFFF' : '#333333';
          ctx.lineWidth = 2;
          ctx.strokeRect(step.position.x - 120, step.position.y - 50, 240, 100);
          break;
        case 'mid-category':
          // 중간 직사각형 (중분류)
          ctx.fillStyle = getNodeColor(step.type, darkMode);
          ctx.fillRect(step.position.x - 110, step.position.y - 45, 220, 90);
          // 테두리 추가
          ctx.strokeStyle = darkMode ? '#FFFFFF' : '#333333';
          ctx.lineWidth = 2;
          ctx.strokeRect(step.position.x - 110, step.position.y - 45, 220, 90);
          break;
        case 'small-category':
          // 작은 직사각형 (소분류)
          ctx.fillStyle = getNodeColor(step.type, darkMode);
          ctx.fillRect(step.position.x - 100, step.position.y - 40, 200, 80);
          // 테두리 추가
          ctx.strokeStyle = darkMode ? '#FFFFFF' : '#333333';
          ctx.lineWidth = 2;
          ctx.strokeRect(step.position.x - 100, step.position.y - 40, 200, 80);
          break;
        default:
          // 기본 직사각형
          ctx.fillStyle = getNodeColor('process', darkMode);
          ctx.fillRect(step.position.x - 100, step.position.y - 40, 200, 80);
          // 테두리 추가
          ctx.strokeStyle = darkMode ? '#FFFFFF' : '#333333';
          ctx.lineWidth = 2;
          ctx.strokeRect(step.position.x - 100, step.position.y - 40, 200, 80);
      }
      
      // 텍스트 그리기
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '16px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 여러 줄 텍스트 지원 (박스 크기에 맞게 조정)
      const maxWidth = step.type === 'decision' ? 160 : 180; // 마름모는 좁은 영역
      const words = step.text.split(' ');
      const lines = [];
      let currentLine = '';
      
      // 줄 바꿈 처리
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine + (currentLine ? ' ' : '') + words[i];
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxWidth && i > 0) {
          lines.push(currentLine);
          currentLine = words[i];
        } else {
          currentLine = testLine;
        }
      }
      if (currentLine) {
        lines.push(currentLine);
      }
      
      // 텍스트 여러 줄 그리기
      const lineHeight = 20;
      const totalHeight = lines.length * lineHeight;
      let textY = step.position.y - totalHeight / 2 + lineHeight / 2;
      
      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], step.position.x, textY);
        textY += lineHeight;
      }
      
      // 라벨 그리기 (번호 표시)
      if (step.label) {
        ctx.font = 'bold 16px Arial';
        ctx.fillStyle = '#FFEB3B';
        // 도형 좌상단 근처에 표시
        let labelX, labelY;
        
        switch(step.type) {
          case 'decision':
            labelX = step.position.x - 100;
            labelY = step.position.y - 50;
            break;
          case 'start':
          case 'end':
            labelX = step.position.x - 85;
            labelY = step.position.y - 35;
            break;
          default:
            labelX = step.position.x - 95;
            labelY = step.position.y - 35;
        }
        
        ctx.fillText(step.label, labelX, labelY);
      }
      
      ctx.restore();
      
      // 연결선 그리기
      if (step.connections && step.connections.length > 0) {
        step.connections.forEach(targetId => {
          const target = data.steps.find(s => s.id === targetId);
          if (target) {
            ctx.beginPath();
            ctx.strokeStyle = darkMode ? '#E0E0E0' : '#424242';
            ctx.lineWidth = 2;
            
            // 출발점과 도착점 계산 (도형 타입에 따라 조정)
            let startX = step.position.x;
            let startY = step.position.y;
            let endX = target.position.x;
            let endY = target.position.y;
            
            // 출발 도형에 따른 연결점 조정
            switch(step.type) {
              case 'start':
              case 'end':
                startY += 50;  // 타원형 하단
                break;
              case 'decision':
                startY += 60;  // 마름모 하단
                break;
              default:
                startY += 50;  // 직사각형 하단
            }
            
            // 도착 도형에 따른 연결점 조정
            switch(target.type) {
              case 'start':
              case 'end':
                endY -= 50;  // 타원형 상단
                break;
              case 'decision':
                endY -= 60;  // 마름모 상단
                break;
              default:
                endY -= 50;  // 직사각형 상단
            }
            
            // 곡선형 연결선 (베지에 곡선)
            const controlPointY = (startY + endY) / 2;
            ctx.moveTo(startX, startY);
            ctx.bezierCurveTo(
              startX, controlPointY,
              endX, controlPointY,
              endX, endY
            );
            ctx.stroke();
            
            // 화살표 그리기
            const arrowSize = 12;
            ctx.beginPath();
            ctx.moveTo(endX, endY);
            ctx.lineTo(endX - arrowSize / 2, endY - arrowSize);
            ctx.lineTo(endX + arrowSize / 2, endY - arrowSize);
            ctx.closePath();
            ctx.fillStyle = darkMode ? '#E0E0E0' : '#424242';
            ctx.fill();
          }
        });
      }
    });
  };
  
  // 마인드맵 렌더링
  const renderMindMap = (ctx, data) => {
    if (!data || !data.steps || !Array.isArray(data.steps) || data.steps.length === 0) return;
    
    const centerX = 400;
    const centerY = 300;
    const nodeRadius = 100;
    
    // 중앙 노드 (루트) 그리기
    const rootNode = data.steps[0];
    if (!rootNode || !rootNode.text) return;
    
    ctx.beginPath();
    ctx.fillStyle = darkMode ? '#9C27B0' : '#673AB7';
    ctx.arc(centerX, centerY, nodeRadius / 2, 0, 2 * Math.PI);
    ctx.fill();
    
    // 루트 텍스트
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(rootNode.text, centerX, centerY);
    
    // 나머지 노드들 그리기 (첫 번째 노드는 루트로 사용)
    if (data.steps.length > 1) {
      const angleStep = (2 * Math.PI) / (data.steps.length - 1);
      
      for (let i = 1; i < data.steps.length; i++) {
        const step = data.steps[i];
        if (!step || !step.type || !step.text) continue;
        
        const angle = angleStep * (i - 1);
        
        // 노드 위치 계산
        const x = centerX + Math.cos(angle) * nodeRadius * 1.5;
        const y = centerY + Math.sin(angle) * nodeRadius * 1.5;
        
        // 선 그리기
        ctx.beginPath();
        ctx.strokeStyle = darkMode ? '#E0E0E0' : '#424242';
        ctx.lineWidth = 2;
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(x, y);
        ctx.stroke();
        
        // 노드 그리기
        ctx.beginPath();
        ctx.fillStyle = getNodeColor(step.type, darkMode);
        ctx.arc(x, y, nodeRadius / 3, 0, 2 * Math.PI);
        ctx.fill();
        
        // 텍스트 그리기
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // 줄바꿈 처리
        const words = step.text.split(' ');
        let line = '';
        let lineHeight = 14;
        let textY = y - lineHeight * (words.length > 1 ? 0.5 : 0);
        
        for (let j = 0; j < words.length && j < 3; j++) {
          ctx.fillText(words[j], x, textY);
          textY += lineHeight;
        }
        
        // 라벨 그리기
        if (step.label) {
          ctx.font = 'bold 12px Arial';
          ctx.fillStyle = '#FFEB3B';
          ctx.fillText(step.label, x - 25, y - 25);
        }
      }
    }
  };
  
  // 피쉬본 다이어그램 렌더링
  const renderFishbone = (ctx, data) => {
    const startX = 100;
    const endX = 700;
    const centerY = 300;
    const spacing = 80;
    
    if (!data.steps || data.steps.length <= 1) return;
    
    // 중심선 그리기
    ctx.beginPath();
    ctx.strokeStyle = darkMode ? '#E0E0E0' : '#424242';
    ctx.lineWidth = 3;
    ctx.moveTo(startX, centerY);
    ctx.lineTo(endX, centerY);
    ctx.stroke();
    
    // 결과 노드 (마지막 노드)
    ctx.beginPath();
    ctx.fillStyle = darkMode ? '#F44336' : '#FF5722';
    ctx.arc(endX, centerY, 40, 0, 2 * Math.PI);
    ctx.fill();
    
    // 결과 텍스트
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 14px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(data.steps[data.steps.length - 1].text, endX, centerY);
    
    // 상위 카테고리 수
    const topCount = Math.floor((data.steps.length - 1) / 2);
    const bottomCount = data.steps.length - 1 - topCount;
    
    // 상단 가지 그리기
    for (let i = 0; i < topCount; i++) {
      const step = data.steps[i];
      const x = startX + (endX - startX) * (i + 1) / (topCount + 1);
      const y = centerY - spacing;
      
      // 가지 선 그리기
      ctx.beginPath();
      ctx.strokeStyle = darkMode ? '#E0E0E0' : '#424242';
      ctx.lineWidth = 2;
      ctx.moveTo(x, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // 노드 그리기
      ctx.beginPath();
      ctx.fillStyle = getNodeColor(step.type, darkMode);
      ctx.fillRect(x - 60, y - 20, 120, 40);
      
      // 텍스트 그리기
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 한 줄로 제한된 텍스트
      const shortText = step.text.length > 15 ? step.text.substring(0, 15) + '...' : step.text;
      ctx.fillText(shortText, x, y);
      
      // 라벨 그리기
      if (step.label) {
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#FFEB3B';
        ctx.fillText(step.label, x - 50, y - 15);
      }
    }
    
    // 하단 가지 그리기
    for (let i = 0; i < bottomCount; i++) {
      const step = data.steps[topCount + i];
      const x = startX + (endX - startX) * (i + 1) / (bottomCount + 1);
      const y = centerY + spacing;
      
      // 가지 선 그리기
      ctx.beginPath();
      ctx.strokeStyle = darkMode ? '#E0E0E0' : '#424242';
      ctx.lineWidth = 2;
      ctx.moveTo(x, centerY);
      ctx.lineTo(x, y);
      ctx.stroke();
      
      // 노드 그리기
      ctx.beginPath();
      ctx.fillStyle = getNodeColor(step.type, darkMode);
      ctx.fillRect(x - 60, y - 20, 120, 40);
      
      // 텍스트 그리기
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '12px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      
      // 한 줄로 제한된 텍스트
      const shortText = step.text.length > 15 ? step.text.substring(0, 15) + '...' : step.text;
      ctx.fillText(shortText, x, y);
      
      // 라벨 그리기
      if (step.label) {
        ctx.font = 'bold 12px Arial';
        ctx.fillStyle = '#FFEB3B';
        ctx.fillText(step.label, x - 50, y - 15);
      }
    }
  };
  
  // 플로우차트 렌더링 함수
  const renderFlowchart = () => {
    if (!flowchartData || !canvasRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 제목 그리기
    if (flowchartTitle) {
      ctx.save();
      ctx.font = 'bold 22px Arial';
      ctx.fillStyle = darkMode ? '#FFFFFF' : '#333333';
      ctx.textAlign = 'center';
      ctx.fillText(flowchartTitle, canvas.width / 2, 40);
      ctx.restore();
    }
    
    // 선택된 차트 유형에 따라 다른 렌더링 함수 호출
    switch(chartType) {
      case 'mindmap':
        renderMindMap(ctx, flowchartData);
        break;
      case 'fishbone':
        renderFishbone(ctx, flowchartData);
        break;
      default:
        renderStandardFlowchart(ctx, flowchartData);
    }
  };
  
  // 캔버스 이벤트 리스너 설정
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    // 편집 모드일 때만 이벤트 리스너 추가
    if (editMode && flowchartData) {
      // 클릭 이벤트
      canvas.addEventListener('mousedown', handleNodeClick);
      canvas.addEventListener('mousedown', handleNodeDragStart);
      
      // 드래그 이벤트
      canvas.addEventListener('mousemove', handleNodeDrag);
      
      // 드래그 종료 이벤트
      canvas.addEventListener('mouseup', handleNodeDragEnd);
      canvas.addEventListener('mouseleave', handleNodeDragEnd);
      
      // 클린업 함수
      return () => {
        canvas.removeEventListener('mousedown', handleNodeClick);
        canvas.removeEventListener('mousedown', handleNodeDragStart);
        canvas.removeEventListener('mousemove', handleNodeDrag);
        canvas.removeEventListener('mouseup', handleNodeDragEnd);
        canvas.removeEventListener('mouseleave', handleNodeDragEnd);
      };
    } else {
      // 편집 모드가 아닐 때는 마우스 오버 이벤트만 추가
      canvas.addEventListener('mousemove', handleMouseMove);
      
      // 클린업 함수
      return () => {
        canvas.removeEventListener('mousemove', handleMouseMove);
      };
    }
  }, [editMode, flowchartData, selectedStep, draggingNodeId]);
  
  // 마우스 hover 관련 상태 추가
  const [hoverNode, setHoverNode] = useState(null);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });
  
  // 마우스 오버 핸들러
  const handleMouseMove = (event) => {
    if (!flowchartData || !flowchartData.steps) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;
    
    // 마우스 위치에 있는 노드 찾기
    const hoveredNode = flowchartData.steps.find(step => {
      if (!step || !step.position || !step.type) return false;
      
      const { position, type } = step;
      
      // 노드 타입에 따른 히트 영역 계산
      let width, height;
      
      switch(type) {
        case 'start':
        case 'end':
          // 타원형 히트 체크
          const dx = x - position.x;
          const dy = y - position.y;
          return (dx * dx) / (100 * 100) + (dy * dy) / (50 * 50) <= 1;
        case 'decision':
          // 마름모 히트 체크 (단순화를 위해 사각형으로 대체)
          return x >= position.x - 120 && x <= position.x + 120 &&
                 y >= position.y - 60 && y <= position.y + 60;
        case 'big-category':
          width = 240;
          height = 100;
          break;
        case 'mid-category':
          width = 220;
          height = 90;
          break;
        case 'small-category':
        case 'process':
        default:
          width = 200;
          height = 80;
      }
      
      // 사각형 히트 체크
      return x >= position.x - width/2 && x <= position.x + width/2 &&
             y >= position.y - height/2 && y <= position.y + height/2;
    });
    
    if (hoveredNode) {
      setHoverNode(hoveredNode);
      setTooltipPosition({ x: event.clientX, y: event.clientY });
    } else {
      setHoverNode(null);
    }
  };
  
  // 엑스포트 핸들러
  const handleExport = () => {
    if (!canvasRef.current || !flowchartData) return;
    
    const canvas = canvasRef.current;
    const dataUrl = canvas.toDataURL('image/png');
    
    // 선택된 내보내기 형식에 따라 처리
    if (exportFormat === 'png') {
      // PNG로 내보내기
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = currentProject + '.png';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } else if (exportFormat === 'word') {
      // Word 형식으로 내보내기 (실제로는 HTML 형식으로 내보내고 Word에서 열 수 있게 함)
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <title>${flowchartTitle || currentProject}</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 40px; }
            h1 { color: #333; text-align: center; }
            .flowchart-image { display: block; margin: 20px auto; max-width: 100%; }
            .description { margin-top: 30px; }
            .steps { margin-top: 20px; }
            .step { margin-bottom: 10px; padding: 5px; }
          </style>
        </head>
        <body>
          <h1>${flowchartTitle || currentProject}</h1>
          <img class="flowchart-image" src="${dataUrl}" alt="플로우차트">
          <div class="description">
            <h2>업무 설명</h2>
            <div class="steps">
              ${flowchartData.steps.map((step, index) => 
                '<div class="step">' + (index + 1) + '. ' + step.text + '</div>'
              ).join('')}
            </div>
          </div>
        </body>
        </html>
      `;
      
      const blob = new Blob([htmlContent], {type: 'application/vnd.ms-word'});
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = currentProject + '.doc';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    }
  };
  
  // 테마 변경
  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };
  
  // 대분류 번호 삽입 함수
  const insertBigNumbering = () => {
    setCurrentNumberingLevel('big');
    const cursorPos = document.getElementById('business-description').selectionStart;
    const textBefore = businessDescription.substring(0, cursorPos);
    const textAfter = businessDescription.substring(cursorPos);
    
    // 기존 대분류 번호 찾기 (정규식 없이 구현)
    let lastNumber = 0;
    let currentIndex = 0;
    
    while (true) {
      const openBracketIdx = businessDescription.indexOf('[', currentIndex);
      if (openBracketIdx === -1) break;
      
      const closeBracketIdx = businessDescription.indexOf(']', openBracketIdx);
      if (closeBracketIdx === -1) break;
      
      const numStr = businessDescription.substring(openBracketIdx + 1, closeBracketIdx);
      const num = parseInt(numStr);
      
      if (!isNaN(num) && num > lastNumber) {
        lastNumber = num;
      }
      
      currentIndex = closeBracketIdx + 1;
    }
    
    const nextNumber = lastNumber + 1;
    setBusinessDescription(textBefore + '[' + nextNumber + '] ' + textAfter);
  };
  
  // 중분류 번호 삽입 함수
  const insertMidNumbering = () => {
    setCurrentNumberingLevel('mid');
    const cursorPos = document.getElementById('business-description').selectionStart;
    const textBefore = businessDescription.substring(0, cursorPos);
    const textAfter = businessDescription.substring(cursorPos);
    
    // 기존 중분류 번호 찾기 (정규식 없이 구현)
    let lastNumber = 0;
    let currentIndex = 0;
    
    while (true) {
      const openBraceIdx = businessDescription.indexOf('{', currentIndex);
      if (openBraceIdx === -1) break;
      
      const closeParenIdx = businessDescription.indexOf(')', openBraceIdx);
      if (closeParenIdx === -1) break;
      
      const numStr = businessDescription.substring(openBraceIdx + 1, closeParenIdx);
      const num = parseInt(numStr);
      
      if (!isNaN(num) && num > lastNumber) {
        lastNumber = num;
      }
      
      currentIndex = closeParenIdx + 1;
    }
    
    const nextNumber = lastNumber + 1;
    setBusinessDescription(textBefore + '{' + nextNumber + ') ' + textAfter);
  };
  
  // 소분류 번호 삽입 함수
  const insertSmallNumbering = () => {
    setCurrentNumberingLevel('small');
    const cursorPos = document.getElementById('business-description').selectionStart;
    const textBefore = businessDescription.substring(0, cursorPos);
    const textAfter = businessDescription.substring(cursorPos);
    
    // 기존 소분류 번호에 기초하여 다음 번호 결정
    const circleNumbers = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩', 
                          '⑪', '⑫', '⑬', '⑭', '⑮', '⑯', '⑰', '⑱', '⑲', '⑳'];
    
    let nextIndex = 0;
    for (let i = 0; i < circleNumbers.length; i++) {
      if (businessDescription.includes(circleNumbers[i])) {
        nextIndex = i + 1;
      }
    }
    
    if (nextIndex >= circleNumbers.length) nextIndex = 0;
    
    setBusinessDescription(textBefore + circleNumbers[nextIndex] + " " + textAfter);
  };
  
  return (
    <div className={`flex flex-col h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-50 text-gray-800'}`}>
      {/* 헤더 */}
      <header className={`p-4 ${darkMode ? 'bg-gray-800' : 'bg-blue-600'} text-white flex justify-between items-center`}>
        <div className="flex items-center">
          <FileText size={24} className="mr-2" />
          <h1 className="text-xl font-bold">업무 흐름 자동 플로우차트 생성기</h1>
        </div>
        <div className="flex items-center">
          <button 
            onClick={() => setShowSettings(!showSettings)} 
            className="p-2 rounded-full hover:bg-opacity-20 hover:bg-white"
          >
            <Settings size={20} />
          </button>
        </div>
      </header>
      
      {/* 메인 컨텐츠 */}
      <div className="flex flex-1 overflow-hidden">
        {/* 사이드바 */}
        <div className={`w-64 p-4 flex flex-col ${darkMode ? 'bg-gray-800' : 'bg-white'} border-r`}>
          <div className="mb-4">
            <h2 className="font-bold mb-2">프로젝트</h2>
            <div className={`p-2 mb-2 rounded ${darkMode ? 'bg-blue-900' : 'bg-blue-100'}`}>
              {currentProject}
            </div>
            <button 
              onClick={() => setShowSaveModal(true)}
              className={`w-full py-2 px-3 rounded flex items-center justify-center ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
            >
              <Save size={16} className="mr-2" />
              저장하기
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto">
            <h2 className="font-bold mb-2">저장된 플로우차트</h2>
            {savedFlowcharts.length === 0 ? (
              <div className={`text-sm ${darkMode ? 'text-gray-400' : 'text-gray-500'} italic`}>
                저장된 플로우차트가 없습니다
              </div>
            ) : (
              <ul>
                {savedFlowcharts.map(chart => (
                  <li 
                    key={chart.id} 
                    className={`p-2 mb-1 rounded cursor-pointer ${darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-100'}`}
                    onClick={() => handleLoadFlowchart(chart.id)}
                  >
                    {chart.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          
          <div className="mt-4">
            <button 
              onClick={handleExport}
              className={`w-full py-2 px-3 rounded flex items-center justify-center ${darkMode ? 'bg-green-600 hover:bg-green-700' : 'bg-green-500 hover:bg-green-600'} text-white`}
            >
              <Download size={16} className="mr-2" />
              내보내기
            </button>
          </div>
        </div>
        
        {/* 메인 작업 영역 */}
        <div className="flex-1 flex flex-col">
          {/* 추가 옵션을 위한 툴바 */}
          <div className={`p-2 ${darkMode ? 'bg-gray-700' : 'bg-gray-100'} border-b flex justify-between items-center`}>
            <div className="flex items-center">
              <span className="mr-2 font-bold">차트 유형:</span>
              <select
                value={chartType}
                onChange={(e) => setChartType(e.target.value)}
                className={`p-1 rounded border ${darkMode ? 'bg-gray-800 text-white border-gray-600' : 'bg-white border-gray-300'}`}
              >
                <option value="flowchart">기본 플로우차트</option>
                <option value="mindmap">마인드맵</option>
                <option value="fishbone">피쉬본 다이어그램</option>
              </select>
            </div>
            <div className="flex items-center">
              <span className="mr-2 font-bold">내보내기:</span>
              <select
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value)}
                className={`p-1 rounded border ${darkMode ? 'bg-gray-800 text-white border-gray-600' : 'bg-white border-gray-300'}`}
              >
                <option value="png">PNG 이미지</option>
                <option value="word">Word 문서</option>
              </select>
            </div>
          </div>
          
          {/* 제목 및 텍스트 입력 영역 */}
          <div className={`p-4 ${darkMode ? 'bg-gray-800' : 'bg-white'} border-b`}>
            <div className="mb-4">
              <h2 className="font-bold mb-2">플로우차트 제목</h2>
              <input
                type="text"
                value={flowchartTitle}
                onChange={(e) => setFlowchartTitle(e.target.value)}
                placeholder="플로우차트 제목을 입력하세요"
                className={`w-full p-3 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>
            
            <h2 className="font-bold mb-2">업무 설명 입력</h2>
            <div className="flex">
              <div className="mr-2 flex flex-col space-y-2">
                <button
                  onClick={insertBigNumbering}
                  className={`p-2 rounded ${darkMode ? 'bg-purple-700 hover:bg-purple-800' : 'bg-purple-100 hover:bg-purple-200'} ${currentNumberingLevel === 'big' ? (darkMode ? 'border-2 border-white' : 'border-2 border-purple-600') : ''}`}
                >
                  <div className="flex items-center">
                    <span className="font-bold">[1]</span>
                    <span className="ml-1 text-xs">대분류</span>
                  </div>
                </button>
                
                <button
                  onClick={insertMidNumbering}
                  className={`p-2 rounded ${darkMode ? 'bg-blue-700 hover:bg-blue-800' : 'bg-blue-100 hover:bg-blue-200'} ${currentNumberingLevel === 'mid' ? (darkMode ? 'border-2 border-white' : 'border-2 border-blue-600') : ''}`}
                >
                  <div className="flex items-center">
                    <span className="font-bold">{'{1)'}</span>
                    <span className="ml-1 text-xs">중분류</span>
                  </div>
                </button>
                
                <button
                  onClick={insertSmallNumbering}
                  className={`p-2 rounded ${darkMode ? 'bg-teal-700 hover:bg-teal-800' : 'bg-teal-100 hover:bg-teal-200'} ${currentNumberingLevel === 'small' ? (darkMode ? 'border-2 border-white' : 'border-2 border-teal-600') : ''}`}
                >
                  <div className="flex items-center">
                    <span className="font-bold">①</span>
                    <span className="ml-1 text-xs">소분류</span>
                  </div>
                </button>
              </div>
              
              <textarea
                id="business-description"
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="업무 단계를 순서대로 입력하세요. 각 단계는 새 줄로 구분합니다. 좌측 버튼을 사용하여 구분 기호를 삽입할 수 있습니다."
                className={`flex-1 p-3 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                rows={8}
              />
            </div>
            <div className="mt-2 flex justify-end">
              <button
                onClick={handleGenerateFlowchart}
                disabled={isLoading || businessDescription.trim() === ''}
                className={`py-2 px-4 rounded ${darkMode ? 'bg-purple-600 hover:bg-purple-700' : 'bg-purple-500 hover:bg-purple-600'} text-white flex items-center ${isLoading || businessDescription.trim() === '' ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    처리 중...
                  </>
                ) : (
                  '플로우차트 생성'
                )}
              </button>
            </div>
          </div>
          
          {/* 플로우차트 캔버스 */}
          <div className="flex-1 overflow-auto relative p-4">
            {flowchartData ? (
              <>
                <div className="absolute top-4 right-4 z-10 flex space-x-2">
                  <button
                    onClick={toggleEditMode}
                    className={`p-2 rounded ${editMode ? (darkMode ? 'bg-yellow-600' : 'bg-yellow-500') : (darkMode ? 'bg-gray-700' : 'bg-gray-200')} ${editMode ? 'text-white' : ''}`}
                    title="편집 모드 전환"
                  >
                    <Edit size={20} />
                  </button>
                  {editMode && (
                    <div className="flex space-x-1">
                      <button
                        onClick={() => addNewNode('process')}
                        className={`p-2 rounded ${darkMode ? 'bg-green-600' : 'bg-green-500'} text-white`}
                        title="처리 노드 추가"
                      >
                        <Plus size={20} />
                      </button>
                      <button
                        onClick={() => addNewNode('decision')}
                        className={`p-2 rounded ${darkMode ? 'bg-blue-600' : 'bg-blue-500'} text-white`}
                        title="판단 노드 추가"
                      >
                        <Plus size={20} />
                      </button>
                    </div>
                  )}
                </div>
                <canvas
                  ref={canvasRef}
                  width={800}
                  height={Math.max(600, flowchartData.steps ? flowchartData.steps.length * 150 : 600)}
                  className={`border rounded mx-auto ${darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'}`}
                />
                {/* 노드 편집 팝업 */}
                {showEditModal && editingNode && (
                  <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-30">
                    <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} w-96`}>
                      <h2 className="text-xl font-bold mb-4">노드 편집</h2>
                      <div className="mb-4">
                        <label className="block mb-2">텍스트</label>
                        <textarea
                          value={editingText}
                          onChange={(e) => setEditingText(e.target.value)}
                          className={`w-full p-2 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                          rows={4}
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block mb-2">노드 타입</label>
                        <select
                          value={editingNode.type || 'process'}
                          onChange={(e) => setEditingNode({...editingNode, type: e.target.value})}
                          className={`w-full p-2 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                        >
                          <option value="process">처리 (사각형)</option>
                          <option value="decision">판단 (마름모)</option>
                          <option value="start">시작 (타원형)</option>
                          <option value="end">종료 (타원형)</option>
                          <option value="big-category">대분류</option>
                          <option value="mid-category">중분류</option>
                          <option value="small-category">소분류</option>
                        </select>
                      </div>
                      <div className="flex justify-between">
                        <button
                          onClick={handleDeleteNode}
                          className={`py-2 px-4 rounded ${darkMode ? 'bg-red-600 hover:bg-red-700' : 'bg-red-500 hover:bg-red-600'} text-white`}
                        >
                          삭제
                        </button>
                        <div className="space-x-2">
                          <button
                            onClick={() => setShowEditModal(false)}
                            className={`py-2 px-4 rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
                          >
                            취소
                          </button>
                          <button
                            onClick={handleEditConfirm}
                            className={`py-2 px-4 rounded ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
                          >
                            확인
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* 툴팁 (원문 내용 말풍선) */}
                {hoverNode && hoverNode.originalText && (
                  <div 
                    className={`absolute p-3 rounded shadow-lg max-w-xs z-50 ${darkMode ? 'bg-gray-800 text-white' : 'bg-white text-gray-800'} border ${darkMode ? 'border-gray-700' : 'border-gray-300'}`}
                    style={{
                      left: tooltipPosition.x + 10,
                      top: tooltipPosition.y + 10,
                      transform: 'translateY(-50%)'
                    }}
                  >
                    <div className="text-sm">
                      <strong className="block mb-1">원문:</strong>
                      {hoverNode.originalText}
                    </div>
                    {hoverNode.label && (
                      <div className="text-xs mt-1 text-gray-400">
                        구분: {hoverNode.label}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className={`h-full flex flex-col items-center justify-center ${darkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                <FileText size={48} className="mb-4 opacity-30" />
                <p>업무 설명을 입력하고 '플로우차트 생성' 버튼을 클릭하세요</p>
                <p className="mt-2 text-sm">편집 모드에서 노드를 클릭하여 내용을 수정하거나 드래그하여 위치를 변경할 수 있습니다.</p>
                <p className="mt-1 text-sm text-blue-500">핵심 단어 근처에 마우스를 가져가면 원문 내용이 표시됩니다.</p>
              </div>
            )}
          </div>
          {/* 도움말 알림창 - 초기 접속 시 표시 */}
          {!flowchartData && (
            <div className="mt-4 p-4 bg-blue-50 text-blue-700 rounded border border-blue-200 shadow-sm">
              <h3 className="font-bold text-lg mb-2">💡 사용 가이드</h3>
              <ul className="list-disc pl-5 space-y-1 text-sm">
                <li>플로우차트 제목과 업무 설명을 입력하세요.</li>
                <li>좌측의 버튼을 사용하여 항목에 대분류 [1], 중분류 {'{1)'}, 소분류 ① 등의 번호를 부여할 수 있습니다.</li>
                <li>판단 단계는 마름모, 처리 단계는 사각형, 시작/종료는 타원형으로 표시됩니다.</li>
                <li>편집 모드에서 노드를 클릭하여 내용을 수정하거나 드래그하여 위치를 변경할 수 있습니다.</li>
                <li>생성된 플로우차트는 PNG 이미지나 Word 문서로 내보낼 수 있습니다.</li>
                <li>작업 내용은 프로젝트로 저장하여 나중에 다시 열 수 있습니다.</li>
              </ul>
            </div>
          )}
        </div>
      </div>
      
      {/* 저장 모달 */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} w-96`}>
            <h2 className="text-xl font-bold mb-4">플로우차트 저장</h2>
            <div className="mb-4">
              <label className="block mb-2">프로젝트 이름</label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder={currentProject}
                className={`w-full p-2 border rounded ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
              />
            </div>
            <div className="mb-4">
              <label className="block mb-2">저장 경로</label>
              <div className={`p-2 border rounded flex ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}>
                <span className="flex-1 truncate">{savePath}</span>
                <button className="ml-2 text-blue-500">
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setShowSaveModal(false)}
                className={`py-2 px-4 rounded ${darkMode ? 'bg-gray-700 hover:bg-gray-600' : 'bg-gray-200 hover:bg-gray-300'}`}
              >
                취소
              </button>
              <button
                onClick={handleSaveFlowchart}
                className={`py-2 px-4 rounded ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
              >
                저장
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 설정 패널 */}
      {showSettings && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-20">
          <div className={`p-6 rounded-lg ${darkMode ? 'bg-gray-800' : 'bg-white'} w-96`}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">설정</h2>
              <button 
                onClick={() => setShowSettings(false)}
                className="p-1 rounded-full hover:bg-gray-200"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block mb-2">저장 경로</label>
              <div className="flex">
                <input
                  type="text"
                  value={savePath}
                  onChange={(e) => setSavePath(e.target.value)}
                  className={`flex-1 p-2 border rounded-l ${darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'}`}
                />
                <button className={`px-3 rounded-r border-t border-r border-b ${darkMode ? 'bg-gray-700 border-gray-600' : 'bg-gray-100 border-gray-300'}`}>
                  <FolderOpen size={16} />
                </button>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="flex items-center cursor-pointer">
                <div className="relative">
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={darkMode}
                    onChange={toggleDarkMode}
                  />
                  <div className={`w-10 h-6 rounded-full ${darkMode ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${darkMode ? 'transform translate-x-4' : ''}`}></div>
                </div>
                <span className="ml-3">다크 모드</span>
              </label>
            </div>
            
            <div className="flex justify-end">
              <button
                onClick={() => setShowSettings(false)}
                className={`py-2 px-4 rounded ${darkMode ? 'bg-blue-600 hover:bg-blue-700' : 'bg-blue-500 hover:bg-blue-600'} text-white`}
              >
                완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FlowchartGenerator;