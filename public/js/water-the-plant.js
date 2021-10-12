console.log('Client-side code running');

const button = document.getElementById('water-the-plant');
button.addEventListener('click', function(e) {
  console.log('Initiating command to water the plant');

  fetch('/water-the-plant', {method: 'POST'})
    .then(function(response) {
      if(response.ok) {
        console.log('Command initiation was a success');
        return;
      }
      throw new Error('Failed to initiate command.');
    })
    .catch(function(error) {
      console.log(error);
    });

});