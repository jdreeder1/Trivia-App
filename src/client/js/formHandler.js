const firstName = document.querySelector('.firstName');
const lastName = document.querySelector('.lastName');
const email = document.querySelector('.email');

//posts formdata to local server
const postData = async (url, data = {}) => {
    console.log(url, data);
    const formData = await fetch(url, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data) 
    });    
    try {
        const placeInfo = await formData.json();
        return placeInfo;
    } catch {
        error => console.log(error);
    }
};

//requires user to fill out all required form values, then passes formdata to post function, where it's sent to local server
const handleSubmit = async (e) => {    
    let formData = new FormData(this);
    postData('/post_qs', formData);     
};

const createTeam = async () => {
    let formData = new FormData(this);
    postData('/post_team', formData);
};

const handleTeams = async () => {
    let formData = new FormData(this);
    postData('/signin', formData);
};

const handleCreate = async () => {
    //let email = await sendEmail();
    try {    
        let formData = new FormData(this);
        postData('/validate', formData); //{firstName: firstName.value, lastName: lastName.value, email: email.value});
    }
    catch(err){
        console.log(err);
    }
    
};

export { 
    postData,
    handleSubmit,
    createTeam,
    handleTeams,
    handleCreate    
 }
