const fs = require('fs');
const path = require('path');

const formsDir = path.join('/Users/mateusz/powderbrowsacademypl/app/components/forms');
const files = fs.readdirSync(formsDir).filter(f => f.endsWith('Form.tsx'));

let modifiedCount = 0;

for (const file of files) {
  const filePath = path.join(formsDir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  let originalContent = content;

  // 1. Fix handleWizardAnswer
  const handleWizardAnswerRegex = /const handleWizardAnswer = \(value: boolean\) => \{[\s\S]*?(?=if \(currentContraindicationIndex < contraindicationKeys\.length\))/m;
  
  if (handleWizardAnswerRegex.test(content)) {
    content = content.replace(handleWizardAnswerRegex, (match) => {
      // Retain the function declaration and the handleContraindicationChange call
      const firstLines = match.split('\n').slice(0, 3).join('\n'); // usually the first 2-3 lines before the logic
      
      return `const handleWizardAnswer = (value: boolean) => {
    handleContraindicationChange(currentContraindicationKey, value);
    
    // For follow-up questions, don't auto-advance — user must click "Dalej"
    const hasFollowUp = currentContraindicationObject?.hasFollowUp;
    const isSafePositive = currentContraindicationObject?.isPositiveAnswerSafe;
    
    // Determine if the answer given requires a follow-up
    // If TAK (true) is safe, then NIE (false) requires a follow-up
    // If TAK (true) is NOT safe (default), then TAK (true) requires a follow-up
    const requiresFollowUp = hasFollowUp && (isSafePositive ? value === false : value === true);
    
    if (requiresFollowUp) {
      return;
    }
    
    `;
    });
  }

  // 2. Fix the "Dalej" button condition
  const dalejConditionRegex = /\{currentContraindicationObject\?\.hasFollowUp &&\s*formData\.przeciwwskazania\[\s*currentContraindicationKey\s*\] === true && \(/g;
  content = content.replace(dalejConditionRegex, `{currentContraindicationObject?.hasFollowUp &&
                        formData.przeciwwskazania[currentContraindicationKey] === (currentContraindicationObject.isPositiveAnswerSafe ? false : true) && (`);

  // 3. Round the progress bar calculation
  const progressRegex = /width:\s*\`\$\{\(\(currentContraindicationIndex \+ 1\) \/ contraindicationKeys\.length\) \* 100\}%\`/g;
  content = content.replace(progressRegex, "width: \\`${Math.round(((currentContraindicationIndex + 1) / contraindicationKeys.length) * 100)}%\\`");

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf8');
    modifiedCount++;
    console.log(`Modified ${file}`);
  }
}

console.log(`Successfully modified ${modifiedCount} files.`);
