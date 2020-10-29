const questions = document.querySelectorAll(".question");
const answer1 = document.querySelectorAll(".answer1");
const answer2 = document.querySelectorAll(".answer2");
const answer3 = document.querySelectorAll(".answer3");
const answer4 = document.querySelectorAll(".answer4");
const correct = document.querySelectorAll(".correct");

//fetches api responses from local server and acts as execution control for helper functions
const updateUI = async () => { 

    const res = await fetch(`/get_qs`);
    try {
        //form.classList.add('hide');
        const resp = await res.text();
        try {
            
            //option1_q1.innerHTML = resp.choice1            
            //console.log(JSON.parse(resp));
            let parsed = JSON.parse(resp);
            questions.forEach((question, i=0) => {
                question.value = parsed[i].q;
                i++;
            });
            correct.forEach((right, i=0) => {
                right.value = parsed[i].correct;
                i++;
            });
            answer1.forEach((option, i=0) => {
                option.value = parsed[i].option1;
                i++;
            });
            answer2.forEach((answer, i=0) => {
                answer.value = parsed[i].option2;
                i++;
            });
            answer3.forEach((answer, i=0) => {
                answer.value = parsed[i].option3;
                i++;
            });
            answer4.forEach((answer, i=0) => {
                answer.value = parsed[i].option4;
                i++;
            });           
        
            console.log(parsed);
        }
        catch(err){
            console.log(err);
        }
    }
    catch(error){
        console.log(error);
    }
    
};
/*
const showQuestionOne = async () => {
    const res = await fetch('/question1');

    try {
        const resp = await res.text();
        try {
            let parsed = JSON.parse(resp);
            console.log(parsed);
        }
        catch(err){
            console.error(err);
        }
    }
    catch(err){
        console.error(err);
    }
};
*/
//export { updateUI }
