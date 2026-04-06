import math
import numpy as np
import copy

class BeamBarStructure:
    def __init__(self, nodes, members, ENForces, ENMoments, orientations, force_vector, lengths, E, A, I, pins, springDoF=None, springStiffness=None, restrainedDoF=None, pinDoF=None):
        self.nodes = nodes
        self.members = members
        self.ENForces = ENForces
        self.ENMoments = ENMoments
        self.orientations = orientations
        self.force_vector = force_vector
        self.lengths = lengths
        self.E = E
        self.A = A
        self.I = I
        self.pins = pins
        self.springDoF = springDoF if springDoF is not None else []
        self.springStiffness = springStiffness if springStiffness is not None else []
        self.restrainedDoF = restrainedDoF if restrainedDoF is not None else []
        self.pinDoF = pinDoF if pinDoF is not None else []

        # Internal matrices and results
        self.nDoF = np.amax(self.members) * 3
        self.Kp = np.zeros([self.nDoF, self.nDoF])
        self.Ks = None
        self.U = None
        self.UG = None
        self.FG = None
        self.mbrForces = None
        self.mbrShears = None
        self.mbrMoments = None
     
    def member_orientation(self, member_no):
        member_index = member_no - 1  # Adjust for 0-based index
        node_i = self.members[member_index][0]  # Node number i
        node_j = self.members[member_index][1]  # Node number j

        xi = self.nodes[node_i - 1][0]  # x-coordinate of node i
        yi = self.nodes[node_i - 1][1]  # y-coordinate of node i
        xj = self.nodes[node_j - 1][0]  # x-coordinate of node j
        yj = self.nodes[node_j - 1][1]  # y-coordinate of node j

        dx = xj - xi
        dy = yj - yi
        mag = math.sqrt(dx ** 2 + dy ** 2)
        member_vector = np.array([dx, dy])

        # Calculate angle theta based on quadrant
        if dx > 0 and dy == 0:
            theta = 0
        elif dx == 0 and dy > 0:
            theta = math.pi / 2
        elif dx < 0 and dy == 0:
            theta = math.pi
        elif dx == 0 and dy < 0:
            theta = 3 * math.pi / 2
        elif dx > 0 and dy > 0:
            ref_vector = np.array([1, 0])
            theta = math.acos(ref_vector.dot(member_vector) / mag)
        elif dx < 0 and dy > 0:
            ref_vector = np.array([0, 1])
            theta = (math.pi / 2) + math.acos(ref_vector.dot(member_vector) / mag)
        elif dx < 0 and dy < 0:
            ref_vector = np.array([-1, 0])
            theta = math.pi + math.acos(ref_vector.dot(member_vector) / mag)
        else:
            ref_vector = np.array([0, -1])
            theta = (3 * math.pi / 2) + math.acos(ref_vector.dot(member_vector) / mag)

        return [theta, mag]

    def apply_equivalent_nodal_actions(self):
        for n, mbr in enumerate(self.members):   
            node_i = mbr[0]  # Node number for node i
            node_j = mbr[1]  # Node number for node j   

            fyi = self.ENForces[n, 0]  # Shear force at node i
            mi = self.ENMoments[n, 0]  # Moment at node i
            fyj = self.ENForces[n, 1]  # Shear force at node j
            mj = self.ENMoments[n, 1]  # Moment at node j 
           
            # Define a transformation matrix
            theta = self.orientations[n]
            c = math.cos(theta)
            s = math.sin(theta)
            T = np.array([[c, s, 0, 0, 0, 0],
                          [-s, c, 0, 0, 0, 0],
                          [0, 0, 1, 0, 0, 0],
                          [0, 0, 0, c, s, 0],
                          [0, 0, 0, -s, c, 0],
                          [0, 0, 0, 0, 0, 1]])  

            ENA_local = np.array([[0, fyi, mi, 0, fyj, mj]]).T  # Local ENA
            ENA_global = np.matmul(T.T, ENA_local)  # Transform to global coordinates     

            ia = 3 * node_i - 3  # index of horizontal DoF for node i
            ja = 3 * node_j - 3  # index of horizontal DoF for node j
           
            # Update force vector with Equivalent Nodal Actions    
            self.force_vector[ia] += ENA_global[0, 0]
            self.force_vector[ia + 1] += ENA_global[1, 0]
            self.force_vector[ia + 2] += ENA_global[2, 0]
            self.force_vector[ja] += ENA_global[3, 0]
            self.force_vector[ja + 1] += ENA_global[4, 0]
            self.force_vector[ja + 2] += ENA_global[5, 0]

    def calculate_global_stiffness(self, member_no):
        """
        Calculate the global stiffness matrix for a beam element
        member_no: The member number 
        """    
        theta = self.orientations[member_no - 1]
        L = self.lengths[member_no - 1]

        c = math.cos(theta)
        s = math.sin(theta)
        
        # Transformation matrix
        TM = np.array([[c, s, 0, 0, 0, 0],
                       [-s, c, 0, 0, 0, 0],
                       [0, 0, 1, 0, 0, 0],
                       [0, 0, 0, c, s, 0],
                       [0, 0, 0, -s, c, 0],
                       [0, 0, 0, 0, 0, 1]])
        
        # Material properties
        E = self.E
        A = self.A
        I = self.I

        # Local stiffness matrix entries
        k11 = E * A / L
        k12 = 0
        k13 = 0
        k14 = -E * A / L
        k15 = 0
        k16 = 0  

        k21 = 0
        k22 = 12 * E * I / L**3
        k23 = -6 * E * I / L**2
        k24 = 0
        k25 = -12 * E * I / L**3
        k26 = -6 * E * I / L**2    

        k31 = 0
        k32 = -6 * E * I / L**2
        k33 = 4 * E * I / L
        k34 = 0
        k35 = 6 * E * I / L**2
        k36 = 2 * E * I / L    

        k41 = -E * A / L
        k42 = 0
        k43 = 0
        k44 = E * A / L
        k45 = 0
        k46 = 0 

        k51 = 0
        k52 = -12 * E * I / L**3
        k53 = 6 * E * I / L**2
        k54 = 0
        k55 = 12 * E * I / L**3
        k56 = 6 * E * I / L**2    

        k61 = 0
        k62 = -6 * E * I / L**2
        k63 = 2 * E * I / L
        k64 = 0
        k65 = 6 * E * I / L**2
        k66 = 4 * E * I / L

        # Assemble local stiffness matrix
        K11 = np.array([[k11, k12, k13],
                        [k21, k22, k23],
                        [k31, k32, k33]])

        K12 = np.array([[k14, k15, k16],
                        [k24, k25, k26],
                        [k34, k35, k36]])

        K21 = np.array([[k41, k42, k43],
                        [k51, k52, k53],
                        [k61, k62, k63]])

        K22 = np.array([[k44, k45, k46],
                        [k54, k55, k56],
                        [k64, k65, k66]])

        # Full local stiffness matrix
        top = np.concatenate((K11, K12), axis=1)
        bottom = np.concatenate((K21, K22), axis=1)
        Kl = np.concatenate((top, bottom), axis=0)

        # Transform to global stiffness matrix
        Kg = TM.T.dot(Kl).dot(TM)

        # Return global stiffness matrix divided into 4 blocks
        K11g = Kg[0:3, 0:3]
        K12g = Kg[0:3, 3:6]
        K21g = Kg[3:6, 0:3]
        K22g = Kg[3:6, 3:6]

        return [K11g, K12g, K21g, K22g]

    def calculate_global_stiffness_pin_left(self, member_no):
        """
        Calculate the global stiffness matrix for a beam element with left end pinned
        member_no: The member number 
        """    
        theta = self.orientations[member_no - 1]
        L = self.lengths[member_no - 1]

        c = math.cos(theta)
        s = math.sin(theta)
        
        # Transformation matrix
        TM = np.array([[c, s, 0, 0, 0],
                       [-s, c, 0, 0, 0],
                       [0, 0, c, s, 0],
                       [0, 0, -s, c, 0],
                       [0, 0, 0, 0, 1]])
        
        # Material properties
        E = self.E
        A = self.A
        I = self.I

        # Local stiffness matrix entries
        k11 = E * A / L
        k12 = 0
        k13 = -E * A / L
        k14 = 0
        k15 = 0  

        k21 = 0
        k22 = 3 * E * I / L**3
        k23 = 0
        k24 = -3 * E * I / L**3
        k25 = -3 * E * I / L**2

        k31 = -E * A / L
        k32 = 0
        k33 = E * A / L
        k34 = 0
        k35 = 0

        k41 = 0
        k42 = -3 * E * I / L**3
        k43 = 0
        k44 = 3 * E * I / L**3
        k45 = 3 * E * I / L**2

        k51 = 0
        k52 = -3 * E * I / L**2
        k53 = 0
        k54 = 3 * E * I / L**2
        k55 = 3 * E * I / L

        # Assemble local stiffness matrix
        K11 = np.array([[k11, k12],
                        [k21, k22]])

        K12 = np.array([[k13, k14, k15],
                        [k23, k24, k25]])

        K21 = np.array([[k31, k32],
                        [k41, k42],
                        [k51, k52]])

        K22 = np.array([[k33, k34, k35],
                        [k43, k44, k45],
                        [k53, k54, k55]])

        # Full local stiffness matrix
        top = np.concatenate((K11, K12), axis=1)
        bottom = np.concatenate((K21, K22), axis=1)
        Kl = np.concatenate((top, bottom), axis=0)

        # Transform to global stiffness matrix
        Kg = TM.T.dot(Kl).dot(TM)

        # Return global stiffness matrix divided into 4 blocks
        K11g = Kg[0:2, 0:2]
        K12g = Kg[0:2, 2:5]
        K21g = Kg[2:5, 0:2]
        K22g = Kg[2:5, 2:5]

        return [K11g, K12g, K21g, K22g]

    def calculate_global_stiffness_pin_right(self, member_no):
        """
        Calculate the global stiffness matrix for a beam element with right end pinned
        member_no: The member number 
        """    
        theta = self.orientations[member_no - 1]
        L = self.lengths[member_no - 1]

        c = math.cos(theta)
        s = math.sin(theta)
        
        # Transformation matrix
        TM = np.array([[c, s, 0, 0, 0],
                       [-s, c, 0, 0, 0],
                       [0, 0, 1, 0, 0],
                       [0, 0, 0, c, s],
                       [0, 0, 0, -s, c]])
        
        # Material properties
        E = self.E
        A = self.A
        I = self.I

        # Local stiffness matrix entries
        k11 = E * A / L
        k12 = 0
        k13 = 0
        k14 = -E * A / L
        k15 = 0  

        k21 = 0
        k22 = 3 * E * I / L**3
        k23 = -3 * E * I / L**2
        k24 = 0
        k25 = -3 * E * I / L**3

        k31 = 0
        k32 = -3 * E * I / L**2
        k33 = 3 * E * I / L
        k34 = 0
        k35 = 3 * E * I / L**2

        k41 = -E * A / L
        k42 = 0
        k43 = 0
        k44 = E * A / L
        k45 = 0

        k51 = 0
        k52 = -3 * E * I / L**3
        k53 = 3 * E * I / L**2
        k54 = 0
        k55 = 3 * E * I / L**3

        # Assemble local stiffness matrix
        K11 = np.array([[k11, k12, k13],
                        [k21, k22, k23],
                        [k31, k32, k33]])

        K12 = np.array([[k14, k15],
                        [k24, k25],
                        [k34, k35]])

        K21 = np.array([[k41, k42, k43],
                        [k51, k52, k53]])

        K22 = np.array([[k44, k45],
                        [k54, k55]])

        # Full local stiffness matrix
        top = np.concatenate((K11, K12), axis=1)
        bottom = np.concatenate((K21, K22), axis=1)
        Kl = np.concatenate((top, bottom), axis=0)

        # Transform to global stiffness matrix
        Kg = TM.T.dot(Kl).dot(TM)

        # Divide global element stiffness matrix into quadrants
        K11g = Kg[0:3, 0:3]
        K12g = Kg[0:3, 3:5]
        K21g = Kg[3:5, 0:3]
        K22g = Kg[3:5, 3:5]

        return [K11g, K12g, K21g, K22g]

    def assemble_primary_stiffness_matrix(self):
        """Assemble the primary stiffness matrix Kp."""
        for n, mbr in enumerate(self.members):
            node_i = mbr[0]  # Node i number
            node_j = mbr[1]  # Node j number

            if self.pins[n, 1] == 0:
                # Pin at node j
                K11, K12, K21, K22 = self.calculate_global_stiffness_pin_right(n + 1)
                ia = 3 * node_i - 3
                ib = 3 * node_i - 1
                ja = 3 * node_j - 3
                jb = 3 * node_j - 2  # Adjust for pin (no moment at node j)
                
            elif self.pins[n, 0] == 0:
                # Pin at node i
                K11, K12, K21, K22 = self.calculate_global_stiffness_pin_left(n + 1)
                ia = 3 * node_i - 3
                ib = 3 * node_i - 2  # Adjust for pin (no moment at node i)
                ja = 3 * node_j - 3
                jb = 3 * node_j - 1
                
            else:
                # No pins
                K11, K12, K21, K22 = self.calculate_global_stiffness(n + 1)
                ia = 3 * node_i - 3
                ib = 3 * node_i - 1
                ja = 3 * node_j - 3
                jb = 3 * node_j - 1

            # Assemble into primary stiffness matrix
            self.Kp[ia:ib+1, ia:ib+1] += K11
            self.Kp[ia:ib+1, ja:jb+1] += K12
            self.Kp[ja:jb+1, ia:ib+1] += K21
            self.Kp[ja:jb+1, ja:jb+1] += K22

    def add_spring_stiffnesses(self):
        """Add spring stiffnesses to the global stiffness matrix Kp."""
        if len(self.springDoF) > 0:
            spring_index = [x - 1 for x in self.springDoF]  # Adjust for Python 0-based indexing
            
            for n, index in enumerate(spring_index):
                self.Kp[index, index] += self.springStiffness[n]

    def extract_structure_stiffness_matrix(self):
        """Extract the structure stiffness matrix Ks from Kp by removing restrained and pinned DoFs."""
        removed_dof = self.restrainedDoF + self.pinDoF  # Combine restrained and pinned DoFs
        removed_index = [x - 1 for x in removed_dof]    # Adjust for Python 0-based indexing

        # Delete rows and columns corresponding to removed DoFs
        Ks = np.delete(self.Kp, removed_index, axis=0)
        Ks = np.delete(Ks, removed_index, axis=1)

        self.Ks = np.matrix(Ks)  # Store as a numpy matrix to allow easy inversion later

    def solve_displacements(self):
        """Solve for unknown displacements U."""
        if self.Ks is None:
            raise ValueError("Structure stiffness matrix Ks not yet extracted.")

        # Combine restrained and pinned DoFs
        removed_dof = self.restrainedDoF + self.pinDoF
        removed_index = [x - 1 for x in removed_dof]

        # Make a copy of the force vector and delete rows for removed DoFs
        force_vector_red = copy.copy(self.force_vector)
        force_vector_red = np.delete(force_vector_red, removed_index, axis=0)

        # Solve for displacements
        self.U = self.Ks.I * force_vector_red  # Using matrix inverse and multiplication

    def solve_reactions(self):
        """Solve for reactions and complete the global displacement vector."""
        if self.U is None:
            raise ValueError("Displacements U have not been solved yet.")

        removed_dof = self.restrainedDoF + self.pinDoF
        removed_index = [x - 1 for x in removed_dof]

        # Create global displacement vector UG
        UG = np.zeros(self.nDoF)
        c = 0  # Counter for position in reduced displacement vector U

        for i in range(self.nDoF):
            if i in removed_index:
                UG[i] = 0  # Imposed zero displacement (restrained)
            else:
                UG[i] = self.U[c]
                c += 1

        UG = np.array([UG]).T  # Make UG a column vector
        self.UG = UG

        # Now compute the global force vector FG = Kp * UG
        self.FG = np.matmul(self.Kp, self.UG)

    def solve_member_actions(self):
        """Solve for member internal actions (Axial Force, Shear, Bending Moment)."""
        if self.UG is None:
            raise ValueError("Global displacement vector UG not available. Solve displacements and reactions first.")

        A = self.A
        E = self.E

        self.mbrForces = []
        self.mbrShears = np.zeros(self.members.shape)
        self.mbrMoments = np.zeros(self.members.shape)

        for n, mbr in enumerate(self.members):
            theta = self.orientations[n]
            L = self.lengths[n]
            node_i = mbr[0]
            node_j = mbr[1]

            c = math.cos(theta)
            s = math.sin(theta)

            if self.pins[n, 1] == 0:
                # Pin at node j
                ia = 3 * node_i - 3
                ib = 3 * node_i - 1
                ja = 3 * node_j - 3
                jb = 3 * node_j - 2

                T = np.array([[c, s, 0, 0, 0],
                              [-s, c, 0, 0, 0],
                              [0, 0, 1, 0, 0],
                              [0, 0, 0, c, s],
                              [0, 0, 0, -s, c]])

                disp = np.array([
                    [self.UG[ia, 0], self.UG[ia+1, 0], self.UG[ib, 0], self.UG[ja, 0], self.UG[jb, 0]]
                ]).T
                disp_local = np.matmul(T, disp)

                F_axial = (A * E / L) * (disp_local[3] - disp_local[0])[0]

                K11, K12, K21, K22 = self.calculate_global_stiffness_pin_right(n + 1)
                Kg = np.concatenate((np.concatenate((K11, K12), axis=1),
                                     np.concatenate((K21, K22), axis=1)), axis=0)
                Kl = T.dot(Kg).dot(T.T)

                Mi = Kl[2, :].dot(disp_local)[0]
                Mj = 0
                Fy_i = Kl[1, :].dot(disp_local)[0]
                Fy_j = Kl[4, :].dot(disp_local)[0]

            elif self.pins[n, 0] == 0:
                # Pin at node i
                ia = 3 * node_i - 3
                ib = 3 * node_i - 2
                ja = 3 * node_j - 3
                jb = 3 * node_j - 1

                T = np.array([[c, s, 0, 0, 0],
                              [-s, c, 0, 0, 0],
                              [0, 0, c, s, 0],
                              [0, 0, -s, c, 0],
                              [0, 0, 0, 0, 1]])

                disp = np.array([
                    [self.UG[ia, 0], self.UG[ib, 0], self.UG[ja, 0], self.UG[ja+1, 0], self.UG[jb, 0]]
                ]).T
                disp_local = np.matmul(T, disp)

                F_axial = (A * E / L) * (disp_local[2] - disp_local[0])[0]

                K11, K12, K21, K22 = self.calculate_global_stiffness_pin_left(n + 1)
                Kg = np.concatenate((np.concatenate((K11, K12), axis=1),
                                     np.concatenate((K21, K22), axis=1)), axis=0)
                Kl = T.dot(Kg).dot(T.T)

                Mi = 0
                Mj = Kl[4, :].dot(disp_local)[0]
                Fy_i = Kl[1, :].dot(disp_local)[0]
                Fy_j = Kl[3, :].dot(disp_local)[0]

            else:
                # No pins
                ia = 3 * node_i - 3
                ib = 3 * node_i - 1
                ja = 3 * node_j - 3
                jb = 3 * node_j - 1

                T = np.array([[c, s, 0, 0, 0, 0],
                              [-s, c, 0, 0, 0, 0],
                              [0, 0, 1, 0, 0, 0],
                              [0, 0, 0, c, s, 0],
                              [0, 0, 0, -s, c, 0],
                              [0, 0, 0, 0, 0, 1]])

                disp = np.array([
                    [self.UG[ia, 0], self.UG[ia+1, 0], self.UG[ib, 0],
                     self.UG[ja, 0], self.UG[ja+1, 0], self.UG[jb, 0]]
                ]).T
                disp_local = np.matmul(T, disp)

                F_axial = (A * E / L) * (disp_local[3] - disp_local[0])[0]

                K11, K12, K21, K22 = self.calculate_global_stiffness(n + 1)
                Kg = np.concatenate((np.concatenate((K11, K12), axis=1),
                                     np.concatenate((K21, K22), axis=1)), axis=0)
                Kl = T.dot(Kg).dot(T.T)

                Mi = Kl[2, :].dot(disp_local)[0]
                Mj = Kl[5, :].dot(disp_local)[0]
                Fy_i = Kl[1, :].dot(disp_local)[0]
                Fy_j = Kl[4, :].dot(disp_local)[0]

            # Store results
            self.mbrForces.append(F_axial)
            self.mbrShears[n, 0] = Fy_i
            self.mbrShears[n, 1] = Fy_j
            self.mbrMoments[n, 0] = Mi
            self.mbrMoments[n, 1] = Mj

    def remove_equivalent_nodal_actions_from_reactions(self):
        """Remove the influence of ENAs from the reaction forces."""
        if self.FG is None:
            raise ValueError("Global force vector FG not available. Solve reactions first.")

        for n, mbr in enumerate(self.members):
            node_i = mbr[0]
            node_j = mbr[1]

            fyi = self.ENForces[n, 0]
            mi = self.ENMoments[n, 0]
            fyj = self.ENForces[n, 1]
            mj = self.ENMoments[n, 1]

            theta = self.orientations[n]
            c = math.cos(theta)
            s = math.sin(theta)

            T = np.array([[c, s, 0, 0, 0, 0],
                          [-s, c, 0, 0, 0, 0],
                          [0, 0, 1, 0, 0, 0],
                          [0, 0, 0, c, s, 0],
                          [0, 0, 0, -s, c, 0],
                          [0, 0, 0, 0, 0, 1]])

            ENA_local = np.array([[0, fyi, mi, 0, fyj, mj]]).T
            ENA_global = np.matmul(T.T, ENA_local)

            ia = 3 * node_i - 3
            ja = 3 * node_j - 3

            self.FG[ia] -= ENA_global[0, 0]
            self.FG[ia+1] -= ENA_global[1, 0]
            self.FG[ia+2] -= ENA_global[2, 0]
            self.FG[ja] -= ENA_global[3, 0]
            self.FG[ja+1] -= ENA_global[4, 0]
            self.FG[ja+2] -= ENA_global[5, 0]

    def remove_equivalent_nodal_actions_from_member_actions(self):
        """Remove the influence of ENAs from member shear forces and bending moments."""
        if self.mbrShears is None or self.mbrMoments is None:
            raise ValueError("Member actions have not been solved yet.")

        for n, mbr in enumerate(self.members):
            Fy_i = self.mbrShears[n, 0]
            Fy_j = self.mbrShears[n, 1]
            Mi = self.mbrMoments[n, 0]
            Mj = self.mbrMoments[n, 1]

            fyi = self.ENForces[n, 0]
            mi = self.ENMoments[n, 0]
            fyj = self.ENForces[n, 1]
            mj = self.ENMoments[n, 1]

            theta = self.orientations[n]
            c = math.cos(theta)
            s = math.sin(theta)

            T = np.array([[c, s, 0, 0, 0, 0],
                          [-s, c, 0, 0, 0, 0],
                          [0, 0, 1, 0, 0, 0],
                          [0, 0, 0, c, s, 0],
                          [0, 0, 0, -s, c, 0],
                          [0, 0, 0, 0, 0, 1]])

            ENA_local = np.array([[0, fyi, mi, 0, fyj, mj]]).T
            ENA_global = np.matmul(T.T, ENA_local)

            calActions_local = np.array([[0, Fy_i, Mi, 0, Fy_j, Mj]]).T
            calActions_global = np.matmul(T.T, calActions_local)

            finalActions_local = np.matmul(T, calActions_global - ENA_global)

            self.mbrShears[n, 0] = finalActions_local[1, 0]
            self.mbrShears[n, 1] = finalActions_local[4, 0]
            self.mbrMoments[n, 0] = finalActions_local[2, 0]
            self.mbrMoments[n, 1] = finalActions_local[5, 0]

    def solve_structure(self):
        """Run the full analysis sequence: assemble, solve, post-process."""
        self.assemble_primary_stiffness_matrix()
        self.add_spring_stiffnesses()
        self.apply_equivalent_nodal_actions()
        self.extract_structure_stiffness_matrix()
        self.solve_displacements()
        self.solve_reactions()
        self.solve_member_actions()
        self.remove_equivalent_nodal_actions_from_reactions()
        self.remove_equivalent_nodal_actions_from_member_actions()

