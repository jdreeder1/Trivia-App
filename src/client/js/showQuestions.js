//script file for index.html => first trivia question page
const question_number = document.querySelector('question_number');
const question_body = document.querySelector('question_body');
const option1_q1 = document.querySelector('option1_q1');
const option2_q1 = document.querySelector('option2_q1');
const option1_q1 = document.querySelector('option3_q1');
const option1_q1 = document.querySelector('option4_q1');
let sub = document.querySelectorAll('.sub');

const hideSubmit = (typeOfUser) => {
    if(typeOfUser == 'player'){ 
        //sub.style.display = 'none';
        sub.forEach(btn => {
            btn.style.display = 'none';
        });
    }
};

/*
const showQuestion = async () => { 

    const res = await fetch(`/trivia`);
    try {
        const resp = await res.text();
        try {
            let parsed = JSON.parse(resp);
            question_number.innerText = parsed.question;
            question_body.innerText = parsed.q;
            option1_q1.innerText = parsed.option1;
            option2_q1.innerText = parsed.option2;
            option3_q1.innerText = parsed.option3;
            option4_q1.innerText = parsed.option4;

            console.log(parsed);
        }
        catch(err){
            console.error(err);
        }
    
    }
    catch(err){
        console.log(err);
    }
};
*/