import { getRepository } from "./services/repository";
import { href } from "./utils/routes";
import "./styles/app.css";
getRepository().then(repo => repo.currentUser()).then(user => location.replace(href(user ? "dashboard" : "login"))).catch(() => location.replace(href("login")));
