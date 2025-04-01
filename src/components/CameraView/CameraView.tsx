import React, { useEffect, useState } from "react";
import { marked } from "marked";
import "./CameraView.css";

interface CameraViewProps {
  problemTitle?: string;
  solution?: string;
  explanation?: string;
}

export const CameraView: React.FC<CameraViewProps> = ({
  problemTitle = "No problem loaded",
  solution = "",
  explanation = "",
}) => {
  const [timeString, setTimeString] = useState<string>("");

  // Update time every second
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setTimeString(now.toLocaleTimeString());
    };

    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Parse markdown in the explanation
  const renderedExplanation = explanation ? marked.parse(explanation) : "";

  return (
    <div className="camera-view-container">
      <div className="camera-header">
        <div className="camera-title">InterviewCoder</div>
        <div className="camera-time">{timeString}</div>
      </div>

      <div className="camera-content">
        <div className="problem-title">{problemTitle}</div>

        {solution && (
          <div className="solution-container">
            <div className="solution-header">Solution:</div>
            <pre className="solution-code">{solution}</pre>
          </div>
        )}

        {explanation && (
          <div className="explanation-container">
            <div className="explanation-header">Explanation:</div>
            <div
              className="explanation-text"
              dangerouslySetInnerHTML={{ __html: renderedExplanation }}
            />
          </div>
        )}
      </div>

      <div className="camera-footer">
        <div className="camera-watermark">powered by InterviewCoder</div>
      </div>
    </div>
  );
};

export default CameraView;
