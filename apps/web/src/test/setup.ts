import "@testing-library/jest-dom";
import { configure } from "@testing-library/react";

// findBy*/waitFor resolve as soon as they match; the longer ceiling only matters
// on loaded CI runners, where the 1 s default fails heavy component renders.
configure({ asyncUtilTimeout: 5000 });
