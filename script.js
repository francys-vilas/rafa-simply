window.addEventListener('scroll', () => {
  const nav = document.getElementById('navbar');
  if (window.scrollY > 50) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
});

document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const formData = {
    nome: e.target.querySelector('input[type="text"]').value,
    whatsapp: e.target.querySelector('input[type="tel"]').value,
    servico: e.target.querySelector('select').value
  };

  try {
    const response = await fetch('/api/leads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (response.ok) {
      alert('Obrigado! Salvamos seu contato. Redirecionando para o WhatsApp...');
      
      // Configurações do WhatsApp
      const seuNumero = "351910169533"; 
      const mensagem = `Olá, meu nome é ${formData.nome}. Tenho interesse em ${formData.servico}. Vi seu site Simplygesso.`;
      const wpUrl = `https://wa.me/${seuNumero}?text=${encodeURIComponent(mensagem)}`;
      
      e.target.reset();
      window.open(wpUrl, '_blank');
    } else {
      alert('Ops! Ocorreu um erro. Tente novamente mais tarde.');
    }
  } catch (err) {
    console.error('Erro na requisição:', err);
    alert('Erro de conexão com o servidor.');
  }
});


// Smooth Scroll
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const targetId = this.getAttribute('href');
        const targetElement = document.querySelector(targetId);
        
        if (targetElement) {
            // Offset for fixed navbar (approx 80px)
            const headerOffset = 85;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

            window.scrollTo({
                top: offsetPosition,
                behavior: "smooth"
            });
        }
    });
});
