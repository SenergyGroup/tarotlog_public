const profileCircle = document.querySelector("#profile-circle");
const dropdownMenu = document.querySelector("#dropdown-menu");

// Profile menu toggle
if (profileCircle && dropdownMenu) {
    profileCircle.addEventListener("click", (event) => {
        dropdownMenu.classList.toggle("show");
        event.stopPropagation();
    });

    document.addEventListener("click", (event) => {
        if (!dropdownMenu.contains(event.target) && !profileCircle.contains(event.target)) {
            dropdownMenu.classList.remove("show");
        }
    });
} else {
    console.error("Profile circle or dropdown menu not found!");
}