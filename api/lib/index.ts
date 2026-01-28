import App from './app';
import PostController from './controllers/post.controller';
import Controller from './interfaces/controller.interface';
import UserController from './controllers/user.controller';


/**
 * Główny punkt startowy aplikacji.
 */
function main() {
    // Lista wszystkich kontrolerów, które mają zostać zainicjowane
    const controllers: Controller[] = [
        new PostController(),
        new UserController()
    ];


    // Tworzenie instancji aplikacji, przekazując tylko listę kontrolerów.
    // Port jest pobierany wewnętrznie przez klasę App z obiektu config.
    const app = new App(controllers);

    // Uruchomienie nasłuchiwania na porcie zdefiniowanym w config
    app.listen();
}

// Wywołanie głównej funkcji
main();