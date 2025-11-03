<!-- Improved compatibility of back to top link: See: https://github.com/rsingla92/medfeedbackscribe/pull/73 -->
<a name="readme-top"></a>

<!-- PROJECT SHIELDS -->
<!--
*** I'm using markdown "reference style" links for readability.
*** Reference links are enclosed in brackets [ ] instead of parentheses ( ).
*** See the bottom of this document for the declaration of the reference variables
*** for contributors-url, forks-url, etc. This is an optional, concise syntax you may use.
*** https://www.markdownguide.org/basic-syntax/#reference-style-links
-->
[![Contributors][contributors-shield]][contributors-url]
[![Forks][forks-shield]][forks-url]
[![Stargazers][stars-shield]][stars-url]
[![Issues][issues-shield]][issues-url]
[![MIT License][license-shield]][license-url]
[![LinkedIn][linkedin-shield]][linkedin-url]

<!-- PROJECT LOGO -->

<br />
<div align="center">
  <a href="https://github.com/rsingla92/medfeedbackscribe">
    <img src="images/logo.png" alt="Logo" width="100" height="100">
  </a>

  <h3 align="center">Medical Feedback Scribe</h3>

  <p align="center">
    AI-powered real-time assessment companion for medical education.
    <br />
    <a href="https://github.com/rsingla92/medfeedbackscribe/docs"><strong>Explore the docs »</strong></a>
    <br />
    <br />
    <a href="https://github.com/rsingla92/medfeedbackscribe/demo">View Demo</a>
    ·
    <a href="https://github.com/rsingla92/medfeedbackscribe/issues">Report Bug</a>
    ·
    <a href="https://github.com/rsingla92/medfeedbackscribe/issues">Request Feature</a>
  </p>
</div>



<!-- TABLE OF CONTENTS -->
<details>
  <summary>Table of Contents</summary>
  <ol>
    <li>
      <a href="#about-the-project">About The Project</a>
      <ul>
        <li><a href="#built-with">Built With</a></li>
      </ul>
    </li>
    <li>
      <a href="#getting-started">Getting Started</a>
      <ul>
        <li><a href="#prerequisites">Prerequisites</a></li>
        <li><a href="#installation">Installation</a></li>
      </ul>
    </li>
    <li><a href="#usage">Usage</a></li>
    <li><a href="#roadmap">Roadmap</a></li>
    <li><a href="#contributing">Contributing</a></li>
    <li><a href="#license">License</a></li>
    <li><a href="#contact">Contact</a></li>
    <li><a href="#acknowledgments">Acknowledgments</a></li>
  </ol>
</details>

<!-- ABOUT THE PROJECT -->
## About The Project
[![MedScribe AI Screenshot][product-screenshot]](https://github.com/rsingla92/medfeedbackscribe)

**MedScribe AI** is a mobile-first, privacy-compliant web app that captures and analyzes real-time feedback conversations between residents/students and supervisors.  
It automatically records, transcribes, classifies, and visualizes structured performance data — all while maintaining strict PHI privacy and compliance.

**Why MedScribe AI?**
* **Frictionless capture:** One-tap recording replaces manual form entry — letting supervisors and residents focus on authentic feedback.  
* **AI-driven insight:** Whisper handles transcription, GPT models classify CanMEDS skills, EPA stages, and milestones in under 60 seconds.  
* **Bias-aware analytics:** Integrated bias detection flags gendered or loaded language to promote equitable evaluations.  
* **Smart dashboards:** Visualize skill progression, milestones, and topic trends over time using intuitive charts.  
* **Privacy-first design:** PHI is anonymized before processing; raw audio is deleted immediately after analysis.  
* **Integration-ready:** Structured exports (JSON/CSV/PDF) map directly to institutional systems like Entrada or One45.

MedScribe AI transforms feedback into structured, actionable intelligence — empowering both learners and educators with real-time, data-driven reflection.

<p align="right">(<a href="#readme-top">back to top</a>)</p>


### Built With
MedScribe AI is built using a modern, modular, and scalable tech stack optimized for **low-latency AI processing**, **mobile-first UX**, and **privacy-compliant data handling**. MedScribe AI integrates **Whisper**, **GPT-4**, and **Chart.js** to provide seamless, end-to-end AI-driven feedback analytics.

#### Frontend
* [![Next][Next.js]][Next-url] — Mobile-first React framework for PWA deployment  
* [![React][React.js]][React-url] — Component-based UI architecture  
* [![Chart.js][Chartjs-shield]](https://www.chartjs.org/) — Interactive analytics dashboards  
* [![TailwindCSS][Tailwind-shield]](https://tailwindcss.com/) — Utility-first responsive styling  

#### Backend
* [![FastAPI][FastAPI-shield]](https://fastapi.tiangolo.com/) — High-performance Python backend for AI pipelines  
* [![Node.js][Node-shield]](https://nodejs.org/) — Optional lightweight API microservices  
* [![PostgreSQL][Postgres-shield]](https://www.postgresql.org/) — Structured and encrypted data storage  
* [![Supabase][Supabase-shield]](https://supabase.com/) — Managed Postgres with authentication and file storage  

#### Integrations & AI
* [![OpenAI][OpenAI-shield]](https://openai.com/) — Whisper (speech-to-text) + GPT (NLP classification)  
* [![Stripe][Stripe-shield]](https://stripe.com/) — Subscription management for premium features  
* [![SendGrid][SendGrid-shield]](https://sendgrid.com/) — Email notifications and weekly reports  

#### DevOps & Monitoring
* [![Vercel][Vercel-shield]](https://vercel.com/) — Frontend hosting with CI/CD  
* [![Fly.io][Flyio-shield]](https://fly.io/) — Containerized backend deployment  
* [![Sentry][Sentry-shield]](https://sentry.io/) — Application monitoring and error tracking  

<p align="right">(<a href="#readme-top">back to top</a>)</p>



<!-- GETTING STARTED -->
## Getting Started

### Prerequisites

### Installation

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- USAGE EXAMPLES -->
## Usage

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ROADMAP -->
## Roadmap
### ✅ Phase 1 – Core MVP (Completed / In Progress)
- [ ] Audio recording module with auto-stop and offline caching  
- [ ] Whisper-based transcription pipeline  
- [ ] GPT-based NLP extraction for CanMEDS, EPA stage, and milestones  
- [ ] Bias detection and flagging system  
- [ ] Interactive analytics dashboards (Chart.js)  
- [ ] Privacy hooks — PHI redaction and post-processing audio deletion  
- [ ] Stripe integration for premium analytics  

### 🚧 Phase 2 – Expansion & Integrations (Planned)
- [ ] Supervisor role with review & bias resolution queue  
- [ ] Offline recording + deferred sync  
- [ ] Institutional integrations (One45 / Entrada / MedHub)  
- [ ] Explainable AI summaries for transparency  
- [ ] Group and program-level analytics + benchmarking  
- [ ] Automated weekly email summaries via SendGrid / Resend  

### 🌍 Phase 3 – Scalability & Advanced Features (Future)
- [ ] Voice identification (multi-speaker separation)  
- [ ] Multilingual transcription support (EN/FR initially)  
- [ ] Custom topic tagging + institutional vocabularies  
- [ ] API endpoints for external reporting and dashboards  
- [ ] Supervisor and resident benchmarking network (cross-institutional)  

See the [open issues](https://github.com/rsingla92/medfeedbackscribe/issues) for a full list of ongoing work, proposed features, and discussions.

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTRIBUTING -->
## Contributing
<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- LICENSE -->
## License
Distributed under the MIT License. See `LICENSE.txt` for more information.
<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- CONTACT -->
## Contact
Your Name - [@your_twitter](https://twitter.com/your_username) - email@example.com
Project Link: [https://github.com/your_username/repo_name](https://github.com/your_username/repo_name)
<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- ACKNOWLEDGMENTS -->
## Acknowledgments
* [Choose an Open Source License](https://choosealicense.com)
* [GitHub Emoji Cheat Sheet](https://www.webpagefx.com/tools/emoji-cheat-sheet)
* [Malven's Flexbox Cheatsheet](https://flexbox.malven.co/)
* [Malven's Grid Cheatsheet](https://grid.malven.co/)
* [Img Shields](https://shields.io)
* [GitHub Pages](https://pages.github.com)
* [Font Awesome](https://fontawesome.com)
* [React Icons](https://react-icons.github.io/react-icons/search)

<p align="right">(<a href="#readme-top">back to top</a>)</p>

<!-- MARKDOWN LINKS & IMAGES -->
<!-- https://www.markdownguide.org/basic-syntax/#reference-style-links -->
[Chartjs-shield]: https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white
[Tailwind-shield]: https://img.shields.io/badge/TailwindCSS-38B2AC?style=for-the-badge&logo=tailwindcss&logoColor=white
[FastAPI-shield]: https://img.shields.io/badge/FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white
[Node-shield]: https://img.shields.io/badge/Node.js-43853D?style=for-the-badge&logo=node.js&logoColor=white
[Postgres-shield]: https://img.shields.io/badge/PostgreSQL-316192?style=for-the-badge&logo=postgresql&logoColor=white
[Supabase-shield]: https://img.shields.io/badge/Supabase-3FCF8E?style=for-the-badge&logo=supabase&logoColor=white
[OpenAI-shield]: https://img.shields.io/badge/OpenAI-412991?style=for-the-badge&logo=openai&logoColor=white
[Stripe-shield]: https://img.shields.io/badge/Stripe-008CDD?style=for-the-badge&logo=stripe&logoColor=white
[SendGrid-shield]: https://img.shields.io/badge/SendGrid-1A82E2?style=for-the-badge&logo=sendgrid&logoColor=white
[Vercel-shield]: https://img.shields.io/badge/Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white
[Flyio-shield]: https://img.shields.io/badge/Fly.io-5A67D8?style=for-the-badge&logo=flydotio&logoColor=white
[Sentry-shield]: https://img.shields.io/badge/Sentry-362D59?style=for-the-badge&logo=sentry&logoColor=white
[contributors-shield]: https://img.shields.io/github/contributors/othneildrew/Best-README-Template.svg?style=for-the-badge
[contributors-url]: https://github.com/rsingla92/medfeedbackscribe/graphs/contributors
[forks-shield]: https://img.shields.io/github/forks/othneildrew/Best-README-Template.svg?style=for-the-badge
[forks-url]: https://github.com/rsingla92/medfeedbackscribe/network/members
[stars-shield]: https://img.shields.io/github/stars/othneildrew/Best-README-Template.svg?style=for-the-badge
[stars-url]: https://github.com/rsingla92/medfeedbackscribe/stargazers
[issues-shield]: https://img.shields.io/github/issues/othneildrew/Best-README-Template.svg?style=for-the-badge
[issues-url]: https://github.com/rsingla92/medfeedbackscribe/issues
[license-shield]: https://img.shields.io/github/license/othneildrew/Best-README-Template.svg?style=for-the-badge
[license-url]: https://github.com/rsingla92/medfeedbackscribe/blob/master/LICENSE.txt
[product-screenshot]: images/screenshot.png
[Next.js]: https://img.shields.io/badge/next.js-000000?style=for-the-badge&logo=nextdotjs&logoColor=white
[Next-url]: https://nextjs.org/
[React.js]: https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB
[React-url]: https://reactjs.org/
[Vue.js]: https://img.shields.io/badge/Vue.js-35495E?style=for-the-badge&logo=vuedotjs&logoColor=4FC08D
[Vue-url]: https://vuejs.org/
[Angular.io]: https://img.shields.io/badge/Angular-DD0031?style=for-the-badge&logo=angular&logoColor=white
[Angular-url]: https://angular.io/
[Svelte.dev]: https://img.shields.io/badge/Svelte-4A4A55?style=for-the-badge&logo=svelte&logoColor=FF3E00
[Svelte-url]: https://svelte.dev/
[Laravel.com]: https://img.shields.io/badge/Laravel-FF2D20?style=for-the-badge&logo=laravel&logoColor=white
[Laravel-url]: https://laravel.com
[Bootstrap.com]: https://img.shields.io/badge/Bootstrap-563D7C?style=for-the-badge&logo=bootstrap&logoColor=white
[Bootstrap-url]: https://getbootstrap.com
[JQuery.com]: https://img.shields.io/badge/jQuery-0769AD?style=for-the-badge&logo=jquery&logoColor=white
[JQuery-url]: https://jquery.com 
