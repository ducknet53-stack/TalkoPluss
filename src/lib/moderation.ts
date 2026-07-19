export const PROFANITY_PATTERNS = [
  /a[\s\.\*@\-_]*m[\s\.\*]*[kq]/i, 
  /a[\s\.\*]*q/i, 
  /o[\s\.\*0]*r[\s\.\*]*o[\s\.\*0]*s[\s\.\*]*p[\s\.\*]*u/i,
  /p[\s\.\*!1]*[iı][\s\.\*]*[cç]/i, 
  /o[\s\.\*0]*[cç]/i, 
  /o[\s\.\*0]*e/i,
  /y[\s\.\*]*a[\s\.\*@]*r[\s\.\*]*r[\s\.\*]*a[\s\.\*]*[kq]/i,
  /y[\s\.\*]*a[\s\.\*@]*r[\s\.\*]*a[\s\.\*]*[kq]/i,
  /s[\s\.\*]*i[\s\.\*1!]*k[\s\.\*]*t[\s\.\*]*i[\s\.\*1!]*r/i,
  /s[\s\.\*]*i[\s\.\*1!]*k[\s\.\*]*i[\s\.\*1!]*k/i,
  /s[\s\.\*]*i[\s\.\*1!]*k[\s\.\*]*e[\s\.\*]*r[\s\.\*]*i[\s\.\*]*m/i,
  /i[\s\.\*1!]*b[\s\.\*]*n[\s\.\*]*e/i,
  /g[\s\.\*]*[öo0][\s\.\*]*t/i,
  /p[\s\.\*]*e[\s\.\*]*z[\s\.\*]*e[\s\.\*]*v[\s\.\*]*e[\s\.\*]*n[\s\.\*]*k/i,
  /k[\s\.\*]*a[\s\.\*]*h[\s\.\*]*p[\s\.\*]*e/i
];

export function hasProfanity(text: string): boolean {
  if (!text) return false;
  
  for (const pattern of PROFANITY_PATTERNS) {
    // Wrap in non-word boundaries manually for better Turkish character support
    const regex = new RegExp(`(^|[\\s\\W_])(${pattern.source})($|[\\s\\W_])`, 'i');
    if (regex.test(text)) {
      return true;
    }
  }
  return false;
}
